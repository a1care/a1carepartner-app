const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Fixes two iOS pod/build issues for the partner app:
 *
 * 1) aosl.xcframework conflict — both `react-native-agora` and
 *    `agora-react-native-rtm` vendor `aosl.xcframework`. A `pre_install` hook
 *    strips the duplicate from the AgoraRtm pod (keeps the RTC engine's copy).
 *
 * 2) react-native-firebase + use_frameworks! (static) emits
 *    `-Wnon-modular-include-in-framework-module` which is treated as an error.
 *    We inject `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES`
 *    into the existing `post_install` hook for every pod target.
 */
module.exports = function withAgoraAoslFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // ── 0. react-native-firebase + use_frameworks! requires this global ──
      if (!podfile.includes('RNFirebaseAsStaticFramework')) {
        podfile = `$RNFirebaseAsStaticFramework = true\n` + podfile;
      }

      // ── 1. pre_install: dedupe aosl.xcframework ──
      if (!podfile.includes('AOSL_DEDUPE_HOOK')) {
        const preHook = `
# AOSL_DEDUPE_HOOK — remove duplicate aosl.xcframework shipped by AgoraRtm
pre_install do |installer|
  installer.pod_targets.each do |pod|
    next unless pod.name == 'AgoraRtm' || pod.name == 'agora-react-native-rtm'
    pod.file_accessors.each do |fa|
      h = fa.spec_consumer.spec.attributes_hash
      h['vendored_frameworks'] = Array(h['vendored_frameworks']).reject { |f| f.to_s.include?('aosl.xcframework') }
      if h['ios']
        h['ios']['vendored_frameworks'] = Array(h['ios']['vendored_frameworks']).reject { |f| f.to_s.include?('aosl.xcframework') }
      end
    end
  end
end
`;
        if (podfile.includes('platform :ios')) {
          podfile = podfile.replace(/platform :ios/, `${preHook}\nplatform :ios`);
        } else {
          podfile = preHook + '\n' + podfile;
        }
      }

      // ── 2. inject CLANG setting into the existing post_install block ──
      if (!podfile.includes('NON_MODULAR_INCLUDES_FIX')) {
        const inject = `
    # NON_MODULAR_INCLUDES_FIX — allow react-native-firebase non-modular headers under use_frameworks!
    installer.pods_project.targets.each do |__t|
      __t.build_configurations.each do |__bc|
        __bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;
        // Insert right after the existing "post_install do |installer|" line.
        const re = /post_install do \|installer\|\s*\n/;
        if (re.test(podfile)) {
          podfile = podfile.replace(re, (m) => m + inject);
        } else {
          // No existing post_install — add one.
          podfile += `\npost_install do |installer|${inject}end\n`;
        }
      }

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
