const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const source = path.join(projectRoot, 'assets', 'adi-registration.properties');
      const targetDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets');
      const target = path.join(targetDir, 'adi-registration.properties');

      if (fs.existsSync(source)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(source, target);
      }

      return modConfig;
    },
  ]);
};
