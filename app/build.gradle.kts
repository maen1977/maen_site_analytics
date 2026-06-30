import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.laithdev.smssender"
    compileSdk = 36

    defaultConfig {
        // Fresh internal id so Xiaomi treats it as a brand-new app.
        applicationId = "com.maensat.sms.sender.safe14"
        minSdk = 21
        // Keep target SDK modern so release build passes Android lint/Google Play checks.
        targetSdk = 36
        versionCode = 16
        versionName = "1.15-default-sms-status-fix"
    }

    signingConfigs {
        create("maensat") {
            storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("maensat")
        }
        release {
            signingConfig = signingConfigs.getByName("maensat")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}
