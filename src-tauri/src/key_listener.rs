//! 全局按键监听与原生事件协议。
//!
//! 对应设计文档 §3.2：只向前端转发归一化后的
//! `letter` / `backspace` / `escape` / `space` / `enter`，
//! 不发送原始系统事件、修饰键、时间戳等信息。

use std::collections::HashSet;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock,
};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// 两次向前端转发事件的最小间隔（毫秒）。
/// 测试时关闭限流，避免连续断言被丢弃。
#[cfg(not(test))]
const EMIT_THROTTLE_MS: u64 = 10;
#[cfg(test)]
const EMIT_THROTTLE_MS: u64 = 0;

use rdev::{EventType, Key};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// 前端监听该事件名接收按键协议事件。
pub const KEY_EVENT_NAME: &str = "key-event";

/// 前端监听该事件名感知全局监听启停状态（如监听线程异常退出时回退到窗口内监听）。
pub const LISTENER_STATUS_EVENT_NAME: &str = "listener-status";

/// 转发给前端的原生事件协议（见 mvp-implementation-design.md §3.2）。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum KeyEvent {
    /// 一个小写字母 `a` 至 `z`。
    Letter {
        key: char,
    },
    Backspace,
    Escape,
    Space,
    Enter,
}

/// 是否已获得 macOS 辅助功能权限。
pub fn has_accessibility_permission() -> bool {
    let trusted = macos_accessibility_client::accessibility::application_is_trusted();
    match std::env::current_exe() {
        Ok(path) => println!(
            "[权限诊断] 当前二进制路径: {:?}, 权限状态: {}",
            path, trusted
        ),
        Err(err) => println!(
            "[权限诊断] 无法获取当前二进制路径: {}, 权限状态: {}",
            err, trusted
        ),
    }
    trusted
}

/// 弹出系统授权提示，返回提示后是否已获得权限。
pub fn request_accessibility_permission() -> bool {
    macos_accessibility_client::accessibility::application_is_trusted_with_prompt()
}

/// 全局监听线程的句柄槽位（同时充当"是否已在监听"标志）。
static LISTENER_SLOT: OnceLock<Mutex<Option<JoinHandle<()>>>> = OnceLock::new();

/// 是否向前端转发全局按键。隐藏窗口时仅暂停转发，保留 rdev 线程以规避其不可中断限制。
static FORWARDING_ENABLED: AtomicBool = AtomicBool::new(false);

fn listener_slot() -> &'static Mutex<Option<JoinHandle<()>>> {
    LISTENER_SLOT.get_or_init(|| Mutex::new(None))
}

/// 是否已启动全局按键监听。
pub fn is_listening() -> bool {
    FORWARDING_ENABLED.load(Ordering::Acquire) && listener_slot().lock().unwrap().is_some()
}

/// 暂停全局按键向前端转发，同时保留不可中断的 rdev 监听线程。
pub fn pause_listening(app: &AppHandle) {
    FORWARDING_ENABLED.store(false, Ordering::Release);
    let _ = app.emit(LISTENER_STATUS_EVENT_NAME, false);
}

/// 幂等启动全局按键监听；未获得辅助功能权限时返回 false 且不启动。
///
/// 已在监听时直接返回 true，避免重复注册监听器（ADR 017）。
pub fn start_listening(app: AppHandle) -> bool {
    if !has_accessibility_permission() {
        println!("未获得辅助功能权限，监听未启动");
        let _ = app.emit(LISTENER_STATUS_EVENT_NAME, false);
        return false;
    }
    let mut slot = listener_slot().lock().unwrap();
    if slot.is_some() {
        FORWARDING_ENABLED.store(true, Ordering::Release);
        let _ = app.emit(LISTENER_STATUS_EVENT_NAME, true);
        return true;
    }
    FORWARDING_ENABLED.store(true, Ordering::Release);
    let status_emitter = app.clone();
    let _ = app.emit(LISTENER_STATUS_EVENT_NAME, true);
    *slot = Some(std::thread::spawn(move || {
        // 监听器运行在后台线程，而 rdev 的字符转换（TSM/TIS API）要求主线程。
        // 必须显式告知 rdev 当前非主线程，否则 macOS 26 会在按键回调中直接终止进程（PR #147）。
        #[cfg(target_os = "macos")]
        rdev::set_is_main_thread(false);
        let mut normalizer = Normalizer::new();
        // 克隆一份供监听退出后推送状态：app 本体会被 move 进 rdev::listen 的闭包
        let result = rdev::listen(move |event| forward_event(event, &mut normalizer, &app));
        // 监听退出（初始化失败或异常），清空槽位以便之后可重新启动，
        // 并通知前端监听已停止，使其回退到窗口内按键监听，避免双向状态静默分歧。
        *listener_slot().lock().unwrap() = None;
        FORWARDING_ENABLED.store(false, Ordering::Release);
        let _ = status_emitter.emit(LISTENER_STATUS_EVENT_NAME, false);
        if let Err(err) = result {
            eprintln!("global keyboard listener failed: {err:?}");
        }
    }));
    true
}

/// 接收 rdev 原始事件，归一化后通过 Tauri 事件转发给前端状态机。
fn forward_event(event: rdev::Event, normalizer: &mut Normalizer, app: &AppHandle) {
    if !FORWARDING_ENABLED.load(Ordering::Acquire) {
        return;
    }
    let forwarded = normalizer.handle(event.event_type);
    // println!("[rdev] raw={:?} -> forwarded={:?}", event.event_type, forwarded);
    if let Some(key_event) = forwarded {
        let _ = app.emit(KEY_EVENT_NAME, key_event);
    }
}

/// 将原始系统事件归一化为协议事件，并跟踪修饰键按下状态。
struct Normalizer {
    /// 当前被按住的修饰键（Command/Control/Option/Shift）。
    modifiers_down: HashSet<Key>,
    /// 上次向前端转发事件的时间，用于限流防止事件风暴。
    last_emit: Option<Instant>,
}

impl Normalizer {
    fn new() -> Self {
        Self {
            modifiers_down: HashSet::new(),
            last_emit: None,
        }
    }

    /// 处理单个原生事件，返回需要转发给前端的协议事件。
    fn handle(&mut self, event: EventType) -> Option<KeyEvent> {
        match event {
            EventType::KeyPress(key) => self.handle_key_down(key),
            EventType::KeyRelease(key) => self.handle_key_up(key),
            // 只监听键盘，忽略鼠标事件
            _ => None,
        }
    }

    fn handle_key_down(&mut self, key: Key) -> Option<KeyEvent> {
        if is_modifier(key) {
            self.modifiers_down.insert(key);
            return None;
        }
        // 任一修饰键被按住期间忽略所有按键（快捷键、大写字母等，见设计文档 §3.2）
        if !self.modifiers_down.is_empty() {
            return None;
        }
        let event = letter_for(key)
            .map(|letter| KeyEvent::Letter { key: letter })
            .or_else(|| control_key_for(key))?;

        // 限流：两次转发间隔过短时丢弃，防止其他全局钩子导致事件风暴。
        let now = Instant::now();
        if let Some(last) = self.last_emit {
            if now.duration_since(last) < Duration::from_millis(EMIT_THROTTLE_MS) {
                return None;
            }
        }
        self.last_emit = Some(now);
        Some(event)
    }

    fn handle_key_up(&mut self, key: Key) -> Option<KeyEvent> {
        if is_modifier(key) {
            self.modifiers_down.remove(&key);
        }
        None
    }
}

/// 是否为需要过滤的修饰键（Command/Control/Option/Shift，含左右之分）。
fn is_modifier(key: Key) -> bool {
    matches!(
        key,
        Key::ShiftLeft
            | Key::ShiftRight
            | Key::ControlLeft
            | Key::ControlRight
            | Key::Alt
            | Key::AltGr
            | Key::MetaLeft
            | Key::MetaRight
    )
}

/// 将 QWERTY 物理键位映射为小写字母（设计文档 §3.2 仅转发小写字母）。
fn letter_for(key: Key) -> Option<char> {
    match key {
        Key::KeyA => Some('a'),
        Key::KeyB => Some('b'),
        Key::KeyC => Some('c'),
        Key::KeyD => Some('d'),
        Key::KeyE => Some('e'),
        Key::KeyF => Some('f'),
        Key::KeyG => Some('g'),
        Key::KeyH => Some('h'),
        Key::KeyI => Some('i'),
        Key::KeyJ => Some('j'),
        Key::KeyK => Some('k'),
        Key::KeyL => Some('l'),
        Key::KeyM => Some('m'),
        Key::KeyN => Some('n'),
        Key::KeyO => Some('o'),
        Key::KeyP => Some('p'),
        Key::KeyQ => Some('q'),
        Key::KeyR => Some('r'),
        Key::KeyS => Some('s'),
        Key::KeyT => Some('t'),
        Key::KeyU => Some('u'),
        Key::KeyV => Some('v'),
        Key::KeyW => Some('w'),
        Key::KeyX => Some('x'),
        Key::KeyY => Some('y'),
        Key::KeyZ => Some('z'),
        _ => None,
    }
}

/// 将控制键映射为协议事件（Backspace/Escape/Space/Enter）。
fn control_key_for(key: Key) -> Option<KeyEvent> {
    match key {
        Key::Backspace => Some(KeyEvent::Backspace),
        Key::Escape => Some(KeyEvent::Escape),
        Key::Space => Some(KeyEvent::Space),
        Key::Return => Some(KeyEvent::Enter),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rdev::{EventType, Key};

    #[test]
    fn maps_letters_without_modifiers() {
        let mut n = Normalizer::new();
        assert_eq!(
            n.handle(EventType::KeyPress(Key::KeyA)),
            Some(KeyEvent::Letter { key: 'a' })
        );
        assert_eq!(
            n.handle(EventType::KeyPress(Key::KeyZ)),
            Some(KeyEvent::Letter { key: 'z' })
        );
    }

    #[test]
    fn maps_control_keys() {
        let mut n = Normalizer::new();
        assert_eq!(
            n.handle(EventType::KeyPress(Key::Backspace)),
            Some(KeyEvent::Backspace)
        );
        assert_eq!(
            n.handle(EventType::KeyPress(Key::Escape)),
            Some(KeyEvent::Escape)
        );
        assert_eq!(
            n.handle(EventType::KeyPress(Key::Space)),
            Some(KeyEvent::Space)
        );
        assert_eq!(
            n.handle(EventType::KeyPress(Key::Return)),
            Some(KeyEvent::Enter)
        );
    }

    #[test]
    fn ignores_other_keys() {
        let mut n = Normalizer::new();
        assert_eq!(n.handle(EventType::KeyPress(Key::F1)), None);
        assert_eq!(n.handle(EventType::KeyPress(Key::Num1)), None);
        assert_eq!(n.handle(EventType::KeyPress(Key::Tab)), None);
        assert_eq!(n.handle(EventType::KeyPress(Key::CapsLock)), None);
    }

    #[test]
    fn ignores_mouse_events() {
        let mut n = Normalizer::new();
        assert_eq!(n.handle(EventType::MouseMove { x: 0.0, y: 0.0 }), None);
    }

    #[test]
    fn filters_keys_while_shift_held() {
        let mut n = Normalizer::new();
        assert_eq!(n.handle(EventType::KeyPress(Key::ShiftLeft)), None);
        // 按住 Shift 时字母不转发（大写字母被忽略）
        assert_eq!(n.handle(EventType::KeyPress(Key::KeyA)), None);
        assert_eq!(n.handle(EventType::KeyRelease(Key::ShiftLeft)), None);
        assert_eq!(
            n.handle(EventType::KeyPress(Key::KeyA)),
            Some(KeyEvent::Letter { key: 'a' })
        );
    }

    #[test]
    fn filters_keys_while_command_held() {
        let mut n = Normalizer::new();
        assert_eq!(n.handle(EventType::KeyPress(Key::MetaLeft)), None);
        // Cmd+S 等快捷键不转发
        assert_eq!(n.handle(EventType::KeyPress(Key::KeyS)), None);
        assert_eq!(n.handle(EventType::KeyRelease(Key::MetaLeft)), None);
        assert_eq!(
            n.handle(EventType::KeyPress(Key::KeyS)),
            Some(KeyEvent::Letter { key: 's' })
        );
    }

    #[test]
    fn filters_control_and_option() {
        let mut n = Normalizer::new();
        for modifier in [
            Key::ControlLeft,
            Key::ControlRight,
            Key::Alt,
            Key::AltGr,
            Key::MetaRight,
            Key::ShiftRight,
        ] {
            assert_eq!(n.handle(EventType::KeyPress(modifier)), None);
            assert_eq!(n.handle(EventType::KeyPress(Key::KeyA)), None);
            assert_eq!(n.handle(EventType::KeyRelease(modifier)), None);
        }
        assert_eq!(
            n.handle(EventType::KeyPress(Key::KeyA)),
            Some(KeyEvent::Letter { key: 'a' })
        );
    }

    #[test]
    fn handles_multiple_modifiers() {
        let mut n = Normalizer::new();
        n.handle(EventType::KeyPress(Key::ShiftLeft));
        n.handle(EventType::KeyPress(Key::MetaLeft));
        assert_eq!(n.handle(EventType::KeyPress(Key::KeyA)), None);
        // 释放一个修饰键后仍受另一个约束
        n.handle(EventType::KeyRelease(Key::ShiftLeft));
        assert_eq!(n.handle(EventType::KeyPress(Key::KeyA)), None);
        n.handle(EventType::KeyRelease(Key::MetaLeft));
        assert_eq!(
            n.handle(EventType::KeyPress(Key::KeyA)),
            Some(KeyEvent::Letter { key: 'a' })
        );
    }

    #[test]
    fn pauses_and_resumes_event_forwarding() {
        FORWARDING_ENABLED.store(true, Ordering::Release);
        assert!(FORWARDING_ENABLED.load(Ordering::Acquire));

        FORWARDING_ENABLED.store(false, Ordering::Release);
        assert!(!FORWARDING_ENABLED.load(Ordering::Acquire));
    }
}
