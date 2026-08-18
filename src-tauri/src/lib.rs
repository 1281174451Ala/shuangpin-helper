mod key_listener;

use std::process::Command;
use tauri::{
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{TrayIconBuilder},
  AppHandle, Emitter, Manager,
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
  tauri::Builder::default()
    .setup(|app| {
      // 构建中文菜单栏
      let menu = MenuBuilder::new(app)
        .item(&MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW, "显示/隐藏窗口").build(app)?)
        .item(&MenuItemBuilder::with_id(MENU_PERMISSION_CHECK, "检查辅助功能权限").build(app)?)
        .item(&MenuItemBuilder::with_id(MENU_OPEN_SETTINGS, "打开系统设置").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id(MENU_EXIT, "退出").build(app)?)
        .build()?;
      app.set_menu(menu)?;

      // 托盘菜单
      let tray_menu = MenuBuilder::new(app)
        .item(&MenuItemBuilder::with_id(MENU_TOGGLE_WINDOW, "显示/隐藏窗口").build(app)?)
        .item(&MenuItemBuilder::with_id(MENU_PERMISSION_CHECK, "检查辅助功能权限").build(app)?)
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
      app.on_menu_event(|app, event| {
        match event.id.as_ref() {
          MENU_TOGGLE_WINDOW => {
            if let Some(window) = app.get_webview_window("main") {
              let is_visible = window.is_visible().unwrap_or(false);
              let _ = if is_visible {
                window.hide()
              } else {
                window.show()
              };
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
        }
      });

      // 关闭窗口时隐藏到托盘而非退出
      if let Some(window) = app.get_webview_window("main") {
        let win = window.clone();
        window.on_window_event(move |event| {
          if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win.hide();
          }
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
      exit_app
    ])
    .run(tauri::generate_context!())
    .expect("error while running ShuangPin Helper");
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
  println!("Rust: request_accessibility_permission 返回结果: {:?}", result);
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

/// 退出应用程序。
#[tauri::command]
fn exit_app(app: AppHandle) {
  app.exit(0);
}