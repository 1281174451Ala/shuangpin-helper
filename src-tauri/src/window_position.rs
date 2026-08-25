use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};

/// 窗口位置持久化文件名。
pub(crate) const WINDOW_POSITION_FILE_NAME: &str = "window-position.json";
/// 拖动停止多久后写入最后坐标。
const POSITION_WRITE_DEBOUNCE: Duration = Duration::from_millis(300);

/// 保存在磁盘中的窗口左上角物理像素坐标。
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub(crate) struct SavedWindowPosition {
    /// 窗口左上角的 X 坐标。
    pub(crate) x: i32,
    /// 窗口左上角的 Y 坐标。
    pub(crate) y: i32,
}

/// 用于判断坐标是否可见的屏幕工作区。
#[derive(Clone, Copy, Debug)]
pub(crate) struct MonitorWorkArea {
    /// 工作区左上角的 X 坐标。
    pub(crate) x: i32,
    /// 工作区左上角的 Y 坐标。
    pub(crate) y: i32,
    /// 工作区的物理像素宽度。
    pub(crate) width: u32,
    /// 工作区的物理像素高度。
    pub(crate) height: u32,
}

/// 窗口的物理像素尺寸。
#[derive(Clone, Copy, Debug)]
pub(crate) struct WindowSize {
    /// 窗口的物理像素宽度。
    pub(crate) width: u32,
    /// 窗口的物理像素高度。
    pub(crate) height: u32,
}

/// 负责缓存最后坐标并在拖动停止后持久化的状态。
pub(crate) struct WindowPositionStore {
    /// 窗口位置文件路径。
    path: PathBuf,
    /// 最近一次原生移动事件中的位置。
    latest_position: Arc<Mutex<Option<SavedWindowPosition>>>,
    /// 唤醒防抖工作线程的通知通道。
    change_sender: mpsc::Sender<()>,
}

impl WindowPositionStore {
    /// 创建窗口位置存储，并启动单线程防抖写入任务。
    ///
    /// # Arguments
    /// * `path` - 窗口位置 JSON 文件的保存位置。
    pub(crate) fn new(path: PathBuf) -> Self {
        let latest_position = Arc::new(Mutex::new(None));
        let (change_sender, change_receiver) = mpsc::channel();
        let worker_position = Arc::clone(&latest_position);
        let worker_path = path.clone();

        thread::spawn(move || {
            while change_receiver.recv().is_ok() {
                loop {
                    match change_receiver.recv_timeout(POSITION_WRITE_DEBOUNCE) {
                        Ok(()) => continue,
                        Err(mpsc::RecvTimeoutError::Timeout) => break,
                        Err(mpsc::RecvTimeoutError::Disconnected) => {
                            persist_latest_position(&worker_path, &worker_position);
                            return;
                        }
                    }
                }
                persist_latest_position(&worker_path, &worker_position);
            }
        });

        Self {
            path,
            latest_position,
            change_sender,
        }
    }

    /// 从磁盘读取上次成功保存的窗口位置。
    pub(crate) fn load(&self) -> Option<SavedWindowPosition> {
        read_position(&self.path)
    }

    /// 更新内存中的最后位置，并重置防抖写入计时。
    ///
    /// # Arguments
    /// * `position` - 原生窗口移动事件提供的物理像素坐标。
    pub(crate) fn record(&self, position: SavedWindowPosition) {
        if let Ok(mut latest_position) = self.latest_position.lock() {
            *latest_position = Some(position);
            let _ = self.change_sender.send(());
        }
    }

    /// 在应用退出前同步写入最后位置。
    pub(crate) fn flush(&self) {
        persist_latest_position(&self.path, &self.latest_position);
    }
}

/// 将最近一次坐标写入磁盘；写入失败时保留内存状态供后续重试。
fn persist_latest_position(path: &Path, latest_position: &Arc<Mutex<Option<SavedWindowPosition>>>) {
    let position = latest_position.lock().ok().and_then(|guard| *guard);
    if let Some(position) = position {
        let _ = write_position(path, position);
    }
}

/// 从 JSON 文件读取窗口坐标；文件缺失或损坏时返回 None，以便使用默认位置。
fn read_position(path: &Path) -> Option<SavedWindowPosition> {
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

/// 使用临时文件替换方式写入窗口坐标，避免写入中断留下半截 JSON。
fn write_position(path: &Path, position: SavedWindowPosition) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let contents = serde_json::to_vec(&position).map_err(io::Error::other)?;
    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, contents)?;
    fs::rename(temporary_path, path)
}

/// 判断以指定坐标恢复的窗口是否与至少一个显示器工作区相交。
pub(crate) fn is_position_visible(
    position: SavedWindowPosition,
    window_size: WindowSize,
    monitors: &[MonitorWorkArea],
) -> bool {
    let window_left = i64::from(position.x);
    let window_top = i64::from(position.y);
    let window_right = window_left + i64::from(window_size.width);
    let window_bottom = window_top + i64::from(window_size.height);

    monitors.iter().any(|monitor| {
        let monitor_left = i64::from(monitor.x);
        let monitor_top = i64::from(monitor.y);
        let monitor_right = monitor_left + i64::from(monitor.width);
        let monitor_bottom = monitor_top + i64::from(monitor.height);
        window_left < monitor_right
            && window_right > monitor_left
            && window_top < monitor_bottom
            && window_bottom > monitor_top
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs, thread,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    /// 创建本测试独占的临时持久化文件路径。
    fn temporary_position_path() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("shuangpin-window-position-{suffix}.json"))
    }

    #[test]
    fn writes_and_reads_saved_window_position() {
        let path = temporary_position_path();
        let position = SavedWindowPosition { x: 1280, y: 240 };

        write_position(&path, position).expect("position should be persisted");

        assert_eq!(read_position(&path), Some(position));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn returns_none_when_the_position_file_is_missing() {
        assert_eq!(read_position(&temporary_position_path()), None);
    }

    #[test]
    fn rejects_a_position_outside_all_monitor_work_areas() {
        let monitors = [MonitorWorkArea {
            x: 0,
            y: 0,
            width: 1440,
            height: 900,
        }];

        assert!(is_position_visible(
            SavedWindowPosition { x: 900, y: 600 },
            WindowSize {
                width: 720,
                height: 240,
            },
            &monitors,
        ));
        assert!(!is_position_visible(
            SavedWindowPosition { x: 2000, y: 1200 },
            WindowSize {
                width: 720,
                height: 240,
            },
            &monitors,
        ));
    }

    #[test]
    fn persists_only_the_last_position_after_the_drag_settles() {
        let path = temporary_position_path();
        let store = WindowPositionStore::new(path.clone());
        let first_position = SavedWindowPosition { x: 120, y: 180 };
        let last_position = SavedWindowPosition { x: 820, y: 360 };

        store.record(first_position);
        store.record(last_position);
        thread::sleep(Duration::from_millis(400));

        assert_eq!(read_position(&path), Some(last_position));
        let _ = fs::remove_file(path);
    }
}
