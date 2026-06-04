const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * iOS-only fix for the Agora aosl.xcframework conflict.
 *
 * Both `react-native-agora` (RTC) and `agora-react-native-rtm` (RTM) vendor their own
 * copy of `aosl.xcframework`. With CocoaPods that produces a "multiple commands produce
 * aosl.xcframework" / duplicate-output error. A `pre_install` hook strips the duplicate
 * from the AgoraRtm pod and keeps the RTC engine's copy.
 *
 * NOTE: The react-native-firebase static-framework build is handled by
 * expo-build-properties `ios.forceStaticLinking` (Expo SDK 54+/RN 0.81+), NOT here.
 */
module.exports = function withAgoraAoslFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

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
        fs.writeFileSync(podfilePath, podfile);
      }

      return cfg;
    },
  ]);
};
