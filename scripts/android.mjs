// Creates the Android project with Capacitor (if it is missing) and applies the game's
// settings: landscape only, full screen, screen kept on, vibration, dark splash, app icon,
// version numbers from the environment and the shared test signing key.
//   npm run build && node scripts/android.mjs
// Runs in GitHub Actions; the android/ folder is generated and not committed.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
const android = join(root, 'android');
const app = join(android, 'app');
const res = join(app, 'src', 'main', 'res');

if (!existsSync(join(root, 'dist', 'index.html'))) {
  throw new Error('dist/ is missing. Run "npm run build" first.');
}
if (!existsSync(android)) {
  execSync('npx cap add android', { cwd: root, stdio: 'inherit' });
} else {
  execSync('npx cap sync android', { cwd: root, stdio: 'inherit' });
}

/** Replaces text in a file and fails loudly if the template changed under us. */
function patch(file, find, replace) {
  const text = readFileSync(file, 'utf8');
  if (text.includes(replace)) return;
  if (!(typeof find === 'string' ? text.includes(find) : find.test(text))) {
    throw new Error(`Could not find ${find} in ${file}. The Capacitor template may have changed.`);
  }
  writeFileSync(file, text.replace(find, replace));
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// ---------- manifest: landscape, vibration ----------
const manifest = join(app, 'src', 'main', 'AndroidManifest.xml');
patch(manifest, /<activity(?![^>]*screenOrientation)/, '<activity android:screenOrientation="sensorLandscape"');
patch(manifest, '</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');

// ---------- main activity: immersive full screen, screen stays on ----------
const pkg = config.appId;
const activity = join(app, 'src', 'main', 'java', ...pkg.split('.'), 'MainActivity.java');
write(activity, `package ${pkg};

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Hides the status and navigation bars; a swipe from the edge shows them briefly. */
    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
`);

// ---------- version numbers and signing ----------
const gradle = join(app, 'build.gradle');
patch(gradle, /versionCode \d+/, 'versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")');
patch(gradle, /versionName "[^"]*"/, 'versionName (System.getenv("VERSION_NAME") ?: "0.1.0-dev")');
patch(gradle, /android \{/, `android {
    signingConfigs {
        testing {
            storeFile file("../../android-signing/test-key.p12")
            storeType "pkcs12"
            storePassword "skylinesniper"
            keyAlias "test"
            keyPassword "skylinesniper"
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.testing
        }
    }`);

// ---------- colours, splash and icon ----------
write(join(res, 'values', 'sc_colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="sc_ink">#0E141B</color>
</resources>
`);
for (const dir of readdirSync(res)) {
  if (!dir.startsWith('drawable')) continue;
  const png = join(res, dir, 'splash.png');
  if (existsSync(png)) rmSync(png);
}
write(join(res, 'drawable', 'splash.xml'), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/sc_ink" />
</layer-list>
`);
const styles = join(res, 'values', 'styles.xml');
const stylesText = readFileSync(styles, 'utf8');
if (stylesText.includes('AppTheme.NoActionBarLaunch') && !stylesText.includes('windowSplashScreenBackground')) {
  writeFileSync(styles, stylesText.replace(
    /(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
    '$1\n        <item name="windowSplashScreenBackground">@color/sc_ink</item>'
  ));
}

// Adaptive icon: a scope reticle on ink, drawn as a vector so no image files are needed.
write(join(res, 'drawable', 'sc_icon_fg.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <path android:strokeColor="#F3F5F7" android:strokeWidth="3"
        android:pathData="M32,54 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0" />
    <path android:strokeColor="#F3F5F7" android:strokeWidth="2.5"
        android:pathData="M54,26 L54,44 M54,64 L54,82 M26,54 L44,54 M64,54 L82,54" />
    <path android:fillColor="#FFB23E"
        android:pathData="M51.5,54 a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0" />
</vector>
`);
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/sc_ink" />
    <foreground android:drawable="@drawable/sc_icon_fg" />
    <monochrome android:drawable="@drawable/sc_icon_fg" />
</adaptive-icon>
`;
write(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
write(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);

console.log('Android project ready: ' + config.appName + ' (' + config.appId + ')');
