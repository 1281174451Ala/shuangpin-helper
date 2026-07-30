/** Starts the desktop shell and creates the floating application window. */
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running ShuangPin Helper");
}
