mod key_listener;

use std::process::Command;
use tauri::AppHandle;

/** Starts the desktop shell and creates the floating application window. */
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // 已获得辅助功能权限时立即开始监听（见设计文档 §5.2、ADR 023）
      key_listener::start_listening(app.handle().clone());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_accessibility_permission,
      request_accessibility_permission,
      open_accessibility_settings,
      start_key_listener,
      get_listener_status
    ])
    .run(tauri::generate_context!())
    .expect("error while running ShuangPin Helper");
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

/// 打开系统设置的“辅助功能”页面，供 macOS 用户手动授权。
#[tauri::command]
fn open_accessibility_settings() {
  let _ = Command::new("open")
    .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
    .spawn();
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
