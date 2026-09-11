use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, RwLock,
    },
};

/// 应用设置文件名。
pub(crate) const SETTINGS_FILE_NAME: &str = "settings.json";

/// 由原生层持久化的用户偏好。
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct ApplicationSettings {
    /// 设置格式版本。
    pub(crate) version: u8,
    /// 当前双拼方案标识。
    #[serde(alias = "scheme_id")]
    pub(crate) scheme_id: String,
    /// 外观模式。
    pub(crate) appearance: String,
    /// 空闲淡化延时（毫秒）；None 表示不淡化。
    #[serde(alias = "idle_fade_delay_ms")]
    pub(crate) idle_fade_delay_ms: Option<u32>,
    /// 空闲时的窗口不透明度。
    #[serde(alias = "idle_opacity")]
    pub(crate) idle_opacity: f64,
}

impl Default for ApplicationSettings {
    /// 返回首次启动使用的应用设置。
    fn default() -> Self {
        Self {
            version: 1,
            scheme_id: "xiaohe".to_owned(),
            appearance: "system".to_owned(),
            idle_fade_delay_ms: Some(3_000),
            idle_opacity: 0.3,
        }
    }
}

impl ApplicationSettings {
    /// 判断设置版本、方案及所有偏好值是否受当前应用版本支持。
    pub(crate) fn is_supported(&self) -> bool {
        let delay_is_valid = match self.idle_fade_delay_ms {
            None => true,
            Some(delay) => (1_000..=30_000).contains(&delay) && delay % 1_000 == 0,
        };
        let opacity_percent = self.idle_opacity * 100.0;
        let rounded_opacity_percent = opacity_percent.round();
        let opacity_is_valid = (opacity_percent - rounded_opacity_percent).abs() < 1e-9
            && (20.0..=100.0).contains(&rounded_opacity_percent)
            && (rounded_opacity_percent as u32).is_multiple_of(5);

        self.version == 1
            && self.scheme_id == "xiaohe"
            && matches!(self.appearance.as_str(), "system" | "light" | "dark")
            && delay_is_valid
            && opacity_is_valid
    }
}

/// 应用设置的文件存储。
pub(crate) struct ApplicationSettingsStore {
    /// 设置文件路径。
    path: PathBuf,
    /// 本次运行使用的设置；写入失败时仍保留最新预览。
    current: RwLock<ApplicationSettings>,
    /// 串行化来自多个窗口的完整原子写入事务。
    save_lock: Mutex<()>,
    /// 本次运行是否从无效设置恢复。
    recovered_from_invalid_settings: AtomicBool,
}

impl ApplicationSettingsStore {
    /// 创建指定路径的设置存储。
    pub(crate) fn new(path: PathBuf) -> Self {
        Self {
            path,
            current: RwLock::new(ApplicationSettings::default()),
            save_lock: Mutex::new(()),
            recovered_from_invalid_settings: AtomicBool::new(false),
        }
    }

    /// 读取设置；文件缺失或损坏时使用默认设置。
    pub(crate) fn load(&self) -> ApplicationSettings {
        let contents = match fs::read(&self.path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                let settings = ApplicationSettings::default();
                *self.current.write().expect("settings write lock") = settings.clone();
                return settings;
            }
            Err(_) => {
                let _ = fs::copy(&self.path, self.path.with_extension("invalid.json"));
                self.recovered_from_invalid_settings
                    .store(true, Ordering::Relaxed);
                let settings = ApplicationSettings::default();
                *self.current.write().expect("settings write lock") = settings.clone();
                return settings;
            }
        };
        let parsed = serde_json::from_slice::<ApplicationSettings>(&contents)
            .ok()
            .filter(ApplicationSettings::is_supported);

        let settings = if let Some(settings) = parsed {
            settings
        } else {
            let _ = fs::write(self.path.with_extension("invalid.json"), contents);
            self.recovered_from_invalid_settings
                .store(true, Ordering::Relaxed);
            ApplicationSettings::default()
        };
        *self.current.write().expect("settings write lock") = settings.clone();
        settings
    }

    /// 返回本次运行当前使用的设置。
    pub(crate) fn current(&self) -> ApplicationSettings {
        self.current.read().expect("settings read lock").clone()
    }

    /// 返回本次运行是否曾因设置无效而回退默认值。
    pub(crate) fn recovered_from_invalid_settings(&self) -> bool {
        self.recovered_from_invalid_settings.load(Ordering::Relaxed)
    }

    /// 原子写入设置，避免中断时留下半截 JSON。
    pub(crate) fn save(&self, settings: &ApplicationSettings) -> io::Result<ApplicationSettings> {
        if !settings.is_supported() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "unsupported settings version or scheme",
            ));
        }
        let _save_guard = self.save_lock.lock().expect("settings save lock");
        *self.current.write().expect("settings write lock") = settings.clone();
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let contents = serde_json::to_vec(settings).map_err(io::Error::other)?;
        let temporary_path = self.path.with_extension("tmp");
        fs::write(&temporary_path, contents)?;
        fs::rename(temporary_path, &self.path)?;
        Ok(settings.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        sync::{Arc, Barrier},
        thread,
        time::{SystemTime, UNIX_EPOCH},
    };

    /// 创建测试独占的设置文件路径。
    fn temporary_settings_path() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!("shuangpin-settings-{suffix}.json"))
    }

    #[test]
    fn uses_xiaohe_defaults_when_settings_file_is_missing() {
        let store = ApplicationSettingsStore::new(temporary_settings_path());

        assert_eq!(store.load(), ApplicationSettings::default());
    }

    #[test]
    fn writes_and_reads_application_settings() {
        let path = temporary_settings_path();
        let store = ApplicationSettingsStore::new(path.clone());
        let settings = ApplicationSettings {
            appearance: "dark".to_owned(),
            idle_fade_delay_ms: None,
            idle_opacity: 0.55,
            ..ApplicationSettings::default()
        };

        let saved = store.save(&settings).expect("settings should persist");

        assert_eq!(saved, settings);
        assert_eq!(store.load(), settings);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn keeps_runtime_settings_when_writing_fails() {
        let path = temporary_settings_path();
        let temporary_path = path.with_extension("tmp");
        let store = ApplicationSettingsStore::new(path.clone());
        let old_settings = ApplicationSettings::default();
        store
            .save(&old_settings)
            .expect("initial settings should persist");
        fs::create_dir(&temporary_path).expect("temporary path should block the next write");
        let changed_settings = ApplicationSettings {
            appearance: "dark".to_owned(),
            ..old_settings.clone()
        };

        store
            .save(&changed_settings)
            .expect_err("blocked temporary path should fail the write");

        assert_eq!(store.current(), changed_settings);
        assert_eq!(
            ApplicationSettingsStore::new(path.clone()).load(),
            old_settings
        );
        let _ = fs::remove_dir(temporary_path);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn serializes_writes_from_multiple_windows() {
        let path = temporary_settings_path();
        let store = Arc::new(ApplicationSettingsStore::new(path.clone()));
        let opacity_values = (20..=100).step_by(5).collect::<Vec<_>>();
        let barrier = Arc::new(Barrier::new(opacity_values.len()));
        let handles = opacity_values
            .into_iter()
            .map(|opacity| {
                let store = Arc::clone(&store);
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    let settings = ApplicationSettings {
                        idle_opacity: f64::from(opacity) / 100.0,
                        ..ApplicationSettings::default()
                    };
                    barrier.wait();
                    store.save(&settings)
                })
            })
            .collect::<Vec<_>>();

        for handle in handles {
            handle
                .join()
                .expect("settings writer should not panic")
                .expect("concurrent settings write should succeed");
        }

        assert_eq!(
            store.current(),
            ApplicationSettingsStore::new(path.clone()).load()
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn serializes_application_settings_for_the_frontend_bridge() {
        let value =
            serde_json::to_value(ApplicationSettings::default()).expect("settings serialize");

        assert_eq!(value["schemeId"], "xiaohe");
        assert_eq!(value["idleFadeDelayMs"], 3_000);
        assert_eq!(value["idleOpacity"], 0.3);
        assert!(value.get("scheme_id").is_none());
    }

    #[test]
    fn falls_back_when_the_persisted_scheme_is_not_registered() {
        let path = temporary_settings_path();
        let diagnostic_path = path.with_extension("invalid.json");
        fs::write(
            &path,
            r#"{"version":1,"schemeId":"unknown","appearance":"system","idleFadeDelayMs":3000,"idleOpacity":0.3}"#,
        )
        .expect("invalid settings fixture should be written");
        let store = ApplicationSettingsStore::new(path.clone());

        assert_eq!(store.load(), ApplicationSettings::default());
        assert!(store.recovered_from_invalid_settings());
        assert_eq!(
            fs::read_to_string(&diagnostic_path).expect("diagnostic copy should be retained"),
            r#"{"version":1,"schemeId":"unknown","appearance":"system","idleFadeDelayMs":3000,"idleOpacity":0.3}"#,
        );
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(diagnostic_path);
    }

    #[test]
    fn retains_non_utf8_settings_as_a_diagnostic_copy() {
        let path = temporary_settings_path();
        let diagnostic_path = path.with_extension("invalid.json");
        let invalid_contents = [0xff, 0xfe, 0xfd];
        fs::write(&path, invalid_contents).expect("invalid settings fixture should be written");
        let store = ApplicationSettingsStore::new(path.clone());

        assert_eq!(store.load(), ApplicationSettings::default());
        assert!(store.recovered_from_invalid_settings());
        assert_eq!(
            fs::read(&diagnostic_path).expect("diagnostic copy should be retained"),
            invalid_contents,
        );
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(diagnostic_path);
    }

    #[test]
    fn rejects_saving_a_scheme_that_is_not_registered() {
        let path = temporary_settings_path();
        let store = ApplicationSettingsStore::new(path.clone());
        let settings = ApplicationSettings {
            scheme_id: "unknown".to_owned(),
            ..ApplicationSettings::default()
        };

        let error = store
            .save(&settings)
            .expect_err("unknown scheme should be rejected");

        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
        assert!(!path.exists());
    }

    #[test]
    fn rejects_settings_values_outside_the_accepted_ranges() {
        let invalid_settings = [
            ApplicationSettings {
                appearance: "sepia".to_owned(),
                ..ApplicationSettings::default()
            },
            ApplicationSettings {
                idle_fade_delay_ms: Some(500),
                ..ApplicationSettings::default()
            },
            ApplicationSettings {
                idle_fade_delay_ms: Some(31_000),
                ..ApplicationSettings::default()
            },
            ApplicationSettings {
                idle_opacity: 0.21,
                ..ApplicationSettings::default()
            },
        ];

        for settings in invalid_settings {
            let path = temporary_settings_path();
            let store = ApplicationSettingsStore::new(path.clone());

            let error = store
                .save(&settings)
                .expect_err("invalid settings should be rejected");

            assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
            assert!(!path.exists());
        }
    }

    #[test]
    fn reads_legacy_snake_case_field_names() {
        let path = temporary_settings_path();
        fs::write(
            &path,
            r#"{"version":1,"scheme_id":"xiaohe","appearance":"dark","idle_fade_delay_ms":5000,"idle_opacity":0.5}"#,
        )
        .expect("legacy settings fixture should be written");
        let store = ApplicationSettingsStore::new(path.clone());

        assert_eq!(
            store.load(),
            ApplicationSettings {
                appearance: "dark".to_owned(),
                idle_fade_delay_ms: Some(5_000),
                idle_opacity: 0.5,
                ..ApplicationSettings::default()
            }
        );
        let _ = fs::remove_file(path);
    }
}
