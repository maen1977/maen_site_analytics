package com.laithdev.smssender

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony

object SmsRoleHelper {
    fun isDefaultSmsApp(context: Context): Boolean {
        val telephonyDefault = Telephony.Sms.getDefaultSmsPackage(context)
        if (telephonyDefault == context.packageName) return true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                if (roleManager.isRoleHeld(RoleManager.ROLE_SMS)) return true
            }
        }

        return false
    }

    fun currentDefaultSmsPackage(context: Context): String {
        val telephonyDefault = Telephony.Sms.getDefaultSmsPackage(context)
        if (!telephonyDefault.isNullOrBlank()) return telephonyDefault

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                if (roleManager.isRoleHeld(RoleManager.ROLE_SMS)) return context.packageName
            }
        }

        return "غير معروف"
    }

    fun openDefaultSmsAppChooser(activity: Activity) {
        val currentDefault = Telephony.Sms.getDefaultSmsPackage(activity)
        activity.getSharedPreferences("sms_sender_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("previous_default_sms_package", currentDefault.orEmpty())
            .apply()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = activity.getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
                activity.startActivity(intent)
                return
            }
        }

        @Suppress("DEPRECATION")
        val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
            putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, activity.packageName)
        }
        activity.startActivity(intent)
    }

    fun openSmsSettings(activity: Activity) {
        openDefaultSmsAppChooser(activity)
    }
}
