mod key_listener;
mod window_position;

use std::process::Command;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition,
};
use window_position::{
    is_position_visible, MonitorWorkArea, SavedWindowPosition, WindowPositionStore, WindowSize,
    WINDOW_POSITION_FILE_NAME,
};

/// 托盘图标资源（16x16 PNG）。
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray-icon.png");

/// 菜单项事件 ID。
const MENU_TOGGLE_WINDOW: &str = "toggle_window";
const MENU_PERMISSION_CHECK: &str = "permission_check";
const MENU_OPEN_SETTINGS: &str = "open_settings";
const MENU_EXIT: &str = "exit";

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

            // 构建中文菜单栏
            let menu = MenuBuilder::new(app)
                .item(&MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW, "显示/隐藏窗口").build(app)?)
                .item(
                    &MenuItemBuilder::with_id(MENU_PERMISSION_CHECK, "检查辅助功能权限")
                        .build(app)?,
                )
                .item(&MenuItemBuilder::with_id(MENU_OPEN_SETTINGS, "打开系统设置").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id(MENU_EXIT, "退出").build(app)?)
                .build()?;
            app.set_menu(menu)?;

            // 托盘菜单
            let tray_menu = MenuBuilder::new(app)
                .item(&MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW, "显示/隐藏窗口").build(app)?)
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

            // 菜单事件处理
            app.on_menu_event(|app, event| match event.id.as_ref() {
                MENU_TOGGLE_WINDOW => {
                    if let Some(window) = app.get_webview_window("main") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        if is_visible {
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
                MENU_OPEN_SETTINGS => {
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
    }
    key_listener::start_listening(app.clone());
}

/// 隐藏主窗口，清空前端双拼状态并暂停全局按键转发。
fn hide_main_window(app: &AppHandle) {
    key_listener::pause_listening(app);
    let _ = app.emit("window-hidden", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
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
