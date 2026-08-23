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

val hasMaenSigning = keystorePropertiesFile.exists() &&
    listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all {
        !keystoreProperties.getProperty(it).isNullOrBlank()
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
        if (hasMaenSigning) {
            create("maensat") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            if (hasMaenSigning) signingConfig = signingConfigs.getByName("maensat")
        }
        release {
            if (hasMaenSigning) signingConfig = signingConfigs.getByName("maensat")
            // Release builds are unsigned when no local/CI keystore is provided.
            // Never store signing credentials in the repository.
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}
