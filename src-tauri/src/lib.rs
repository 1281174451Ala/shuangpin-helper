mod key_listener;
mod settings;
mod window_position;

use settings::{ApplicationSettings, ApplicationSettingsStore, SETTINGS_FILE_NAME};
use std::process::Command;
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
};
use window_position::{
    is_position_visible, MonitorWorkArea, SavedWindowPosition, WindowPositionStore, WindowSize,
    WINDOW_POSITION_FILE_NAME,
};

/// 托盘图标资源（16x16 PNG）。
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray-icon.png");

/// 菜单项事件 ID。
const MENU_TOGGLE_WINDOW: &str = "toggle_window";
const MENU_OPEN_APP_SETTINGS: &str = "open_app_settings";
const MENU_PERMISSION_CHECK: &str = "permission_check";
const MENU_OPEN_ACCESSIBILITY_SETTINGS: &str = "open_accessibility_settings";
const MENU_EXIT: &str = "exit";
/// 原生窗口移动时通知前端继续保持活动状态的事件名。
const WINDOW_MOVED_EVENT: &str = "window-moved";
/// 应用设置持久化成功后向全部窗口广播的事件名。
const APPLICATION_SETTINGS_CHANGED_EVENT: &str = "application-settings-changed";

/// 两处窗口显隐菜单项，需同步更新文案。
struct WindowToggleMenuItems {
    application_menu: MenuItem<tauri::Wry>,
    tray_menu: MenuItem<tauri::Wry>,
}

/// 首次打开设置窗口时使用的固定窗口规格。
#[derive(Clone, Copy, Debug, PartialEq)]
struct SettingsWindowSpec {
    /// Tauri 窗口标签。
    label: &'static str,
    /// 设置视图入口 URL。
    url: &'static str,
    /// 原生标题栏文字。
    title: &'static str,
    /// 窗口内容宽度。
    width: f64,
    /// 窗口内容高度。
    height: f64,
    /// 创建时是否获得焦点。
    focused: bool,
    /// 是否允许用户调整大小。
    resizable: bool,
    /// 是否保持置顶。
    always_on_top: bool,
}

/// 打开设置入口时应采取的原生窗口动作。
#[derive(Clone, Copy, Debug, PartialEq)]
enum SettingsWindowAction {
    /// 显示并聚焦已有设置窗口。
    FocusExisting,
    /// 按指定规格创建新设置窗口。
    Create(SettingsWindowSpec),
}

/// 根据设置窗口是否存在决定复用或创建。
fn settings_window_action(window_exists: bool) -> SettingsWindowAction {
    if window_exists {
        return SettingsWindowAction::FocusExisting;
    }

    SettingsWindowAction::Create(SettingsWindowSpec {
        label: "settings",
        url: "index.html?window=settings",
        title: "双拼辅助键盘设置",
        width: 420.0,
        height: 280.0,
        focused: true,
        resizable: false,
        always_on_top: false,
    })
}

/// Starts the desktop shell and creates the floating application window.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _vwd| {
            show_main_window(app);
        }))
        .setup(|app| {
            let position_path = app.path().app_config_dir()?.join(WINDOW_POSITION_FILE_NAME);
            app.manage(WindowPositionStore::new(position_path));
            let settings_path = app.path().app_config_dir()?.join(SETTINGS_FILE_NAME);
            let settings_store = ApplicationSettingsStore::new(settings_path);
            let _settings = settings_store.load();
            app.manage(settings_store);

            // 构建中文菜单栏
            let application_toggle_item =
                MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW, window_toggle_text(false))
                    .build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&application_toggle_item)
                .item(&MenuItemBuilder::with_id(MENU_OPEN_APP_SETTINGS, "打开应用设置").build(app)?)
                .item(
                    &MenuItemBuilder::with_id(MENU_PERMISSION_CHECK, "检查辅助功能权限")
                        .build(app)?,
                )
                .item(
                    &MenuItemBuilder::with_id(MENU_OPEN_ACCESSIBILITY_SETTINGS, "打开辅助功能设置")
                        .build(app)?,
                )
                .separator()
                .item(&MenuItemBuilder::with_id(MENU_EXIT, "退出").build(app)?)
                .build()?;
            app.set_menu(menu)?;

            // 托盘菜单
            let tray_toggle_item =
                MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW, window_toggle_text(false))
                    .build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&tray_toggle_item)
                .item(&MenuItemBuilder::with_id(MENU_OPEN_APP_SETTINGS, "打开应用设置").build(app)?)
                .item(
                    &MenuItemBuilder::with_id(MENU_PERMISSION_CHECK, "检查辅助功能权限")
                        .build(app)?,
                )
                .separator()
                .item(&MenuItemBuilder::with_id(MENU_EXIT, "退出").build(app)?)
                .build()?;

            // 托盘图标：左键自动弹出菜单，通过菜单项操作
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(tauri::image::Image::from_bytes(TRAY_ICON)?)
                .icon_as_template(true)
                .menu(&tray_menu)
                .build(app)?;

            app.manage(WindowToggleMenuItems {
                application_menu: application_toggle_item,
                tray_menu: tray_toggle_item,
            });
            sync_window_toggle_text(
                &app.handle(),
                app.get_webview_window("main")
                    .and_then(|window| window.is_visible().ok())
                    .unwrap_or(false),
            );

            // 菜单事件处理
            app.on_menu_event(|app, event| match event.id.as_ref() {
                MENU_TOGGLE_WINDOW => {
                    if let Some(window) = app.get_webview_window("main") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        let is_minimized = window.is_minimized().unwrap_or(false);
                        if is_visible && !is_minimized {
                            hide_main_window(app);
                        } else {
                            show_main_window(app);
                        }
                    }
                }
                MENU_PERMISSION_CHECK => {
                    let granted = key_listener::has_accessibility_permission();
                    let _ = app.emit("permission-check-result", granted);
                }
                MENU_OPEN_APP_SETTINGS => {
                    open_settings_window(app);
                }
                MENU_OPEN_ACCESSIBILITY_SETTINGS => {
                    open_accessibility_settings_impl();
                }
                MENU_EXIT => {
                    app.exit(0);
                }
                _ => {}
            });

            // 关闭窗口时隐藏到托盘而非退出
            if let Some(window) = app.get_webview_window("main") {
                // 关闭 NSWindow 原生矩形阴影：透明窗口 + CSS border-radius 时，
                // 原生阴影仍为矩形，会在圆角外露出灰色直角线。
                // 改由前端 filter: drop-shadow 提供跟随圆角的阴影。
                let _ = window.set_shadow(false);
                restore_main_window_position(&window, &app.state::<WindowPositionStore>());
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::Moved(position) => {
                        app_handle
                            .state::<WindowPositionStore>()
                            .record(SavedWindowPosition {
                                x: position.x,
                                y: position.y,
                            });
                        let _ = app_handle.emit(WINDOW_MOVED_EVENT, ());
                    }
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        hide_main_window(&app_handle);
                    }
                    _ => {}
                });
            }

            // 已获得辅助功能权限时立即开始监听（见设计文档 §5.2、ADR 023）
            key_listener::start_listening(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_accessibility_permission,
            request_accessibility_permission,
            open_accessibility_settings,
            start_key_listener,
            get_listener_status,
            get_application_settings,
            get_application_settings_recovery_status,
            save_application_settings,
            hide_window,
            exit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building ShuangPin Helper");

    app.run(|app, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => show_main_window(app),
        tauri::RunEvent::Exit => app.state::<WindowPositionStore>().flush(),
        _ => {}
    });
}

/// 打开可编辑的设置窗口；已存在时只将其置于前台。
fn open_settings_window(app: &AppHandle) {
    let existing_window = app.get_webview_window("settings");
    match settings_window_action(existing_window.is_some()) {
        SettingsWindowAction::FocusExisting => {
            if let Some(window) = existing_window {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SettingsWindowAction::Create(spec) => {
            let _ = WebviewWindowBuilder::new(app, spec.label, WebviewUrl::App(spec.url.into()))
                .title(spec.title)
                .inner_size(spec.width, spec.height)
                .focused(spec.focused)
                .resizable(spec.resizable)
                .always_on_top(spec.always_on_top)
                .build();
        }
    }
}

/// 恢复与当前任一显示器工作区相交的上次窗口位置。
fn restore_main_window_position(
    window: &tauri::WebviewWindow,
    position_store: &WindowPositionStore,
) {
    let Some(position) = position_store.load() else {
        return;
    };
    let Ok(window_size) = window.outer_size() else {
        return;
    };
    let Ok(monitors) = window.available_monitors() else {
        return;
    };
    let work_areas = monitors
        .iter()
        .map(|monitor| {
            let work_area = monitor.work_area();
            MonitorWorkArea {
                x: work_area.position.x,
                y: work_area.position.y,
                width: work_area.size.width,
                height: work_area.size.height,
            }
        })
        .collect::<Vec<_>>();

    if is_position_visible(
        position,
        WindowSize {
            width: window_size.width,
            height: window_size.height,
        },
        &work_areas,
    ) {
        let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
    }
}

/// 显示主窗口、恢复按键转发并让 macOS 将应用带到前台。
fn show_main_window(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.show();

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        sync_window_toggle_text(app, window.is_visible().unwrap_or(true));
    }
    key_listener::start_listening(app.clone());
}

/// 隐藏主窗口，清空前端双拼状态并暂停全局按键转发。
fn hide_main_window(app: &AppHandle) {
    key_listener::pause_listening(app);
    let _ = app.emit("window-hidden", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        sync_window_toggle_text(app, window.is_visible().unwrap_or(false));
    }
}

/// 根据窗口当前状态返回菜单项应表达的下一步操作。
fn window_toggle_text(is_visible: bool) -> &'static str {
    if is_visible {
        "隐藏窗口"
    } else {
        "显示窗口"
    }
}

/// 同步应用菜单与托盘菜单中的窗口显隐操作文案。
fn sync_window_toggle_text(app: &AppHandle, is_visible: bool) {
    let text = window_toggle_text(is_visible);
    let menu_items = app.state::<WindowToggleMenuItems>();
    let _ = menu_items.application_menu.set_text(text);
    let _ = menu_items.tray_menu.set_text(text);
}

fn open_accessibility_settings_impl() {
    let _ = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}

/// 查询当前是否已获得 macOS 辅助功能权限。
#[tauri::command]
fn get_accessibility_permission() -> bool {
    key_listener::has_accessibility_permission()
}

/// 弹出系统授权提示并返回授权结果（仅由用户在设置界面主动触发）。
#[tauri::command]
fn request_accessibility_permission() -> bool {
    println!("Rust: request_accessibility_permission 被调用");
    let result = key_listener::request_accessibility_permission();
    println!(
        "Rust: request_accessibility_permission 返回结果: {:?}",
        result
    );
    result
}

/// 打开系统设置的"辅助功能"页面，供 macOS 用户手动授权。
#[tauri::command]
fn open_accessibility_settings() {
    open_accessibility_settings_impl();
}

/// 幂等启动全局按键监听；未授权时返回 false。
#[tauri::command]
fn start_key_listener(app: AppHandle) -> bool {
    key_listener::start_listening(app)
}

/// 查询全局按键监听是否已启动。
#[tauri::command]
fn get_listener_status() -> bool {
    key_listener::is_listening()
}

/// 读取当前应用设置，供设置窗口和悬浮窗口使用。
#[tauri::command]
fn get_application_settings(
    settings_store: tauri::State<ApplicationSettingsStore>,
) -> ApplicationSettings {
    settings_store.load()
}

/// 查询本次启动是否曾从无效应用设置恢复。
#[tauri::command]
fn get_application_settings_recovery_status(
    settings_store: tauri::State<ApplicationSettingsStore>,
) -> bool {
    settings_store.recovered_from_invalid_settings()
}

/// 保存应用设置并在下一次启动时恢复。
#[tauri::command]
fn save_application_settings(
    app: AppHandle,
    settings_store: tauri::State<ApplicationSettingsStore>,
    settings: ApplicationSettings,
) -> Result<ApplicationSettings, String> {
    let saved_settings = settings_store
        .save(&settings)
        .map_err(|error| error.to_string())?;
    app.emit(APPLICATION_SETTINGS_CHANGED_EVENT, &saved_settings)
        .map_err(|error| error.to_string())?;
    Ok(saved_settings)
}

/// 隐藏主窗口并暂停全局按键转发。
#[tauri::command]
fn hide_window(app: AppHandle) {
    hide_main_window(&app);
}

/// 退出应用程序。
#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::{settings_window_action, window_toggle_text, SettingsWindowAction};

    #[test]
    fn window_toggle_text_describes_the_next_action() {
        assert_eq!(window_toggle_text(true), "隐藏窗口");
        assert_eq!(window_toggle_text(false), "显示窗口");
    }

    #[test]
    fn settings_window_entry_reuses_an_existing_window() {
        assert_eq!(
            settings_window_action(true),
            SettingsWindowAction::FocusExisting
        );
    }

    #[test]
    fn settings_window_entry_creates_the_accepted_window() {
        let SettingsWindowAction::Create(spec) = settings_window_action(false) else {
            panic!("missing settings window should be created");
        };

        assert_eq!(spec.label, "settings");
        assert_eq!(spec.url, "index.html?window=settings");
        assert!(spec.focused);
        assert!(!spec.always_on_top);
        assert!(!spec.resizable);
    }
}
