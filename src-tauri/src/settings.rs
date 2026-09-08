use serde::{Deserialize, Serialize};
use std::{fs, io, path::PathBuf};

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
    /// 判断设置版本与方案是否受当前应用版本支持。
    fn is_supported(&self) -> bool {
        self.version == 1 && self.scheme_id == "xiaohe"
    }
}

/// 应用设置的文件存储。
pub(crate) struct ApplicationSettingsStore {
    /// 设置文件路径。
    path: PathBuf,
}

impl ApplicationSettingsStore {
    /// 创建指定路径的设置存储。
    pub(crate) fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// 读取设置；文件缺失或损坏时使用默认设置。
    pub(crate) fn load(&self) -> ApplicationSettings {
        fs::read_to_string(&self.path)
            .ok()
            .and_then(|contents| serde_json::from_str(&contents).ok())
            .filter(ApplicationSettings::is_supported)
            .unwrap_or_default()
    }

    /// 原子写入设置，避免中断时留下半截 JSON。
    pub(crate) fn save(&self, settings: &ApplicationSettings) -> io::Result<ApplicationSettings> {
        if !settings.is_supported() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "unsupported settings version or scheme",
            ));
        }
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
    use std::time::{SystemTime, UNIX_EPOCH};

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
            ..ApplicationSettings::default()
        };

        let saved = store.save(&settings).expect("settings should persist");

        assert_eq!(saved, settings);
        assert_eq!(store.load(), settings);
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
        fs::write(
            &path,
            r#"{"version":1,"schemeId":"unknown","appearance":"system","idleFadeDelayMs":3000,"idleOpacity":0.3}"#,
        )
        .expect("invalid settings fixture should be written");
        let store = ApplicationSettingsStore::new(path.clone());

        assert_eq!(store.load(), ApplicationSettings::default());
        let _ = fs::remove_file(path);
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
}
