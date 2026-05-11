// Babel 설정 — reanimated 플러그인 포함 (llama.rn 네이티브 빌드 호환)
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
