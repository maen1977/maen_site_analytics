package com.laithdev.smssender

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import kotlin.math.ceil
import kotlin.math.min

class MainActivity : Activity() {
    private lateinit var messageEditText: EditText
    private lateinit var delayEditText: EditText
    private lateinit var batchLimitEditText: EditText
    private lateinit var smsBudgetEditText: EditText
    private lateinit var loadContactsButton: Button
    private lateinit var newCampaignButton: Button
    private lateinit var continueCampaignButton: Button
    private lateinit var stopButton: Button
    private lateinit var resetCampaignButton: Button
    private lateinit var defaultSmsButton: Button
    private lateinit var defaultSmsStatusTextView: TextView
    private lateinit var contactsCountTextView: TextView
    private lateinit var campaignStatusTextView: TextView
    private lateinit var statusTextView: TextView
    private lateinit var logTextView: TextView

    private val prefs by lazy { getSharedPreferences("sms_sender_prefs", MODE_PRIVATE) }
    private var loadedNumbers = arrayListOf<String>()
    private var totalNumbersRead = 0
    private var skippedNumbers = 0
    private var duplicateNumbers = 0
    private var internationalSkippedNumbers = 0
    private var landlineSkippedNumbers = 0
    private var invalidSkippedNumbers = 0
    private var emptySkippedNumbers = 0

    private val progressReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != AppConstants.ACTION_PROGRESS) return

            val batchSent = intent.getIntExtra(AppConstants.EXTRA_BATCH_SENT, 0)
            val batchFailed = intent.getIntExtra(AppConstants.EXTRA_BATCH_FAILED, 0)
            val batchAttempted = intent.getIntExtra(AppConstants.EXTRA_BATCH_ATTEMPTED, 0)
            val batchSmsParts = intent.getIntExtra(AppConstants.EXTRA_BATCH_SMS_PARTS, 0)
            val totalSent = intent.getIntExtra(AppConstants.EXTRA_TOTAL_SENT, 0)
            val totalFailed = intent.getIntExtra(AppConstants.EXTRA_TOTAL_FAILED, 0)
            val totalSmsParts = intent.getIntExtra(AppConstants.EXTRA_TOTAL_SMS_PARTS, 0)
            val total = intent.getIntExtra(AppConstants.EXTRA_TOTAL, 0)
            val nextIndex = intent.getIntExtra(AppConstants.EXTRA_NEXT_INDEX, 0)
            val current = intent.getStringExtra(AppConstants.EXTRA_CURRENT_NUMBER).orEmpty()
            val status = intent.getStringExtra(AppConstants.EXTRA_STATUS).orEmpty()
            val stopReason = intent.getStringExtra(AppConstants.EXTRA_STOP_REASON).orEmpty()
            val liveEvent = intent.getStringExtra(AppConstants.EXTRA_LIVE_EVENT).orEmpty()
            val remaining = (total - nextIndex).coerceAtLeast(0)

            statusTextView.text = buildString {
                append("الحالة: ")
                append(
                    when (status) {
                        AppConstants.STATUS_RUNNING -> "جاري الإرسال"
                        AppConstants.STATUS_DONE -> "اكتملت الحملة"
                        AppConstants.STATUS_PAUSED_LIMIT -> "توقفت الدفعة عند الحد"
                        AppConstants.STATUS_STOPPED -> "تم الإيقاف"
                        AppConstants.STATUS_FATAL_ERROR -> "توقف بسبب خطأ كبير"
                        else -> "جاهز"
                    }
                )
                append("\nهذه الدفعة: محاولة $batchAttempted | تم: $batchSent | فشل: $batchFailed | SMS مقدّر: $batchSmsParts")
                append("\nإجمالي الحملة: تم: $totalSent | فشل: $totalFailed | SMS مقدّر: $totalSmsParts")
                append("\nالتالي: ${if (remaining == 0) "لا يوجد" else nextIndex + 1} | المتبقي: $remaining")
                if (current.isNotBlank()) append("\nآخر رقم: $current")
                if (liveEvent.isNotBlank()) append("\nآخر حدث: $liveEvent")
                if (stopReason.isNotBlank()) append("\nالسبب: $stopReason")
            }

            logTextView.text = SendLogStore.readLastLines(this@MainActivity, 50)
            updateCampaignStatus()

            val running = status == AppConstants.STATUS_RUNNING
            setRunningState(running)
            if (status == AppConstants.STATUS_DONE || status == AppConstants.STATUS_PAUSED_LIMIT || status == AppConstants.STATUS_STOPPED || status == AppConstants.STATUS_FATAL_ERROR) {
                updateDefaultSmsStatus()
                val message = if (status == AppConstants.STATUS_FATAL_ERROR) {
                    "توقفت الحملة بسبب خطأ كبير: $stopReason"
                } else {
                    "انتهت/توقفت الدفعة. لا تنسَ إعادة تطبيق الرسائل الأصلي إذا انتهيت."
                }
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        messageEditText = findViewById(R.id.messageEditText)
        delayEditText = findViewById(R.id.delayEditText)
        batchLimitEditText = findViewById(R.id.batchLimitEditText)
        smsBudgetEditText = findViewById(R.id.smsBudgetEditText)
        loadContactsButton = findViewById(R.id.loadContactsButton)
        newCampaignButton = findViewById(R.id.newCampaignButton)
        continueCampaignButton = findViewById(R.id.continueCampaignButton)
        stopButton = findViewById(R.id.stopButton)
        resetCampaignButton = findViewById(R.id.resetCampaignButton)
        defaultSmsButton = findViewById(R.id.defaultSmsButton)
        defaultSmsStatusTextView = findViewById(R.id.defaultSmsStatusTextView)
        contactsCountTextView = findViewById(R.id.contactsCountTextView)
        campaignStatusTextView = findViewById(R.id.campaignStatusTextView)
        statusTextView = findViewById(R.id.statusTextView)
        logTextView = findViewById(R.id.logTextView)

        messageEditText.setText(
            prefs.getString(
                "message",
                "أهلاً وسهلاً، معكم maensat لخدمات الستالايت. لأي صيانة أو ضبط قنوات أو تركيب، يسعدنا تواصلكم معنا. لإيقاف رسائل التذكير الرجاء الرد بكلمة إيقاف."
            )
        )
        delayEditText.setText(prefs.getLong("delay_seconds", 10L).toString())
        batchLimitEditText.setText(prefs.getInt("batch_contact_limit", 1700).toString())
        smsBudgetEditText.setText(prefs.getInt("sms_part_limit", 1700).toString())
        logTextView.text = SendLogStore.readLastLines(this, 50)
        updateCampaignStatus()
        updateDefaultSmsStatus()

        requestNeededPermissions()

        loadContactsButton.setOnClickListener { loadContacts() }
        newCampaignButton.setOnClickListener { confirmNewCampaign() }
        continueCampaignButton.setOnClickListener { confirmContinueCampaign() }
        stopButton.setOnClickListener { stopSending() }
        resetCampaignButton.setOnClickListener { confirmResetCampaign() }
        defaultSmsButton.setOnClickListener { SmsRoleHelper.openDefaultSmsAppChooser(this) }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(AppConstants.ACTION_PROGRESS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(progressReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(progressReceiver, filter)
        }
        updateCampaignStatus()
        updateDefaultSmsStatus()
    }

    override fun onResume() {
        super.onResume()
        // Xiaomi/MIUI often returns to the app without recreating it after the SMS-default chooser.
        // Refresh the status every time the screen becomes visible again.
        updateCampaignStatus()
        updateDefaultSmsStatus()
    }

    override fun onStop() {
        super.onStop()
        runCatching { unregisterReceiver(progressReceiver) }
        saveInputs()
    }

    private fun requiredPermissions(): Array<String> {
        val permissions = mutableListOf(
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        return permissions.toTypedArray()
    }

    private fun hasAllPermissions(): Boolean {
        return requiredPermissions().all {
            checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestNeededPermissions() {
        val missing = requiredPermissions().filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), 500)
        }
    }

    private fun loadContacts() {
        if (!hasAllPermissions()) {
            requestNeededPermissions()
            Toast.makeText(this, "وافق على الصلاحيات أولاً", Toast.LENGTH_SHORT).show()
            return
        }

        contactsCountTextView.text = "جاري تحميل الأرقام..."
        loadContactsButton.isEnabled = false

        Thread {
            val result = ContactsReader.readPhoneNumbers(this)
            loadedNumbers = result.numbers
            totalNumbersRead = result.totalRead
            skippedNumbers = result.skipped
            duplicateNumbers = result.duplicates
            internationalSkippedNumbers = result.internationalSkipped
            landlineSkippedNumbers = result.landlineSkipped
            invalidSkippedNumbers = result.invalidSkipped
            emptySkippedNumbers = result.emptySkipped

            runOnUiThread {
                contactsCountTextView.text = contactsReportText()
                loadContactsButton.isEnabled = true
                Toast.makeText(this, "تم تجهيز ${loadedNumbers.size} رقم أردني فريد", Toast.LENGTH_SHORT).show()
            }
        }.start()
    }

    private fun contactsReportText(): String {
        return buildString {
            append("إجمالي الأرقام المقروءة: $totalNumbersRead\n")
            append("أرقام أردنية صالحة وفريدة: ${loadedNumbers.size}\n")
            append("أرقام مكررة لن يُرسل لها مرتين: $duplicateNumbers\n")
            append("أرقام دولية مستبعدة من الإرسال: $internationalSkippedNumbers\n")
            append("أرقام أرضية مستبعدة من الإرسال: $landlineSkippedNumbers\n")
            append("أرقام غير صالحة/فارغة مستبعدة: ${invalidSkippedNumbers + emptySkippedNumbers}\n")
            append("ملاحظة: لم يتم حذف أو تعديل أي جهة اتصال من الهاتف.")
        }
    }

    private fun confirmNewCampaign() {
        if (!validateCommonInputs(requireContacts = true)) return

        val message = messageEditText.text.toString().trim()
        val delaySeconds = getDelaySeconds() ?: return
        val contactLimit = getBatchContactLimit() ?: return
        val smsPartLimit = getSmsPartLimit() ?: return
        val partsPerMessage = SmsPartCounter.countParts(message).coerceAtLeast(1)
        val maxBySms = (smsPartLimit / partsPerMessage).coerceAtLeast(0)
        val willTry = min(loadedNumbers.size, min(contactLimit, maxBySms))

        if (willTry <= 0) {
            Toast.makeText(this, "حد SMS أقل من أجزاء الرسالة الواحدة. اختصر الرسالة أو ارفع الحد.", Toast.LENGTH_LONG).show()
            return
        }

        saveInputs()
        val durationText = estimateDurationText(willTry, delaySeconds)

        AlertDialog.Builder(this)
            .setTitle("بدء حملة جديدة")
            .setMessage(
                "سيتم إنشاء حملة جديدة من الأرقام الأردنية الصالحة فقط.\n\n" +
                    contactsReportText() + "\n\n" +
                    "حد الأرقام لهذه الدفعة: $contactLimit\n" +
                    "حد أجزاء SMS المقدّرة: $smsPartLimit\n" +
                    "أجزاء الرسالة الواحدة تقريباً: $partsPerMessage\n" +
                    "المتوقع في هذه الدفعة: $willTry رقم تقريباً\n" +
                    "المدة المتوقعة: $durationText\n\n" +
                    "أي حملة قديمة سيتم استبدالها."
            )
            .setPositiveButton("ابدأ حملة جديدة") { _, _ ->
                CampaignStore.startNewCampaign(this, message, loadedNumbers)
                SendLogStore.clear(this)
                updateCampaignStatus()
                startCampaignBatch()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun confirmContinueCampaign() {
        if (!validateCommonInputs(requireContacts = false)) return

        val campaign = CampaignStore.load(this)
        if (campaign == null) {
            Toast.makeText(this, "لا توجد حملة محفوظة للمتابعة", Toast.LENGTH_LONG).show()
            return
        }
        if (campaign.completed || campaign.remainingNumbers <= 0) {
            Toast.makeText(this, "الحملة الحالية مكتملة. ابدأ حملة جديدة للشهر القادم.", Toast.LENGTH_LONG).show()
            return
        }

        val delaySeconds = getDelaySeconds() ?: return
        val contactLimit = getBatchContactLimit() ?: return
        val smsPartLimit = getSmsPartLimit() ?: return
        val partsPerMessage = SmsPartCounter.countParts(campaign.message).coerceAtLeast(1)
        val maxBySms = (smsPartLimit / partsPerMessage).coerceAtLeast(0)
        val willTry = min(campaign.remainingNumbers, min(contactLimit, maxBySms))

        if (willTry <= 0) {
            Toast.makeText(this, "حد SMS أقل من أجزاء الرسالة الواحدة. اختصر الرسالة في حملة جديدة أو ارفع الحد.", Toast.LENGTH_LONG).show()
            return
        }

        saveInputs()
        val durationText = estimateDurationText(willTry, delaySeconds)

        AlertDialog.Builder(this)
            .setTitle("متابعة الحملة")
            .setMessage(
                "سيتم المتابعة من الرقم رقم ${campaign.nextIndex + 1} من ${campaign.totalNumbers}.\n\n" +
                    "المتبقي: ${campaign.remainingNumbers}\n" +
                    "حد الأرقام لهذه الدفعة: $contactLimit\n" +
                    "حد أجزاء SMS المقدّرة: $smsPartLimit\n" +
                    "أجزاء الرسالة الواحدة تقريباً: $partsPerMessage\n" +
                    "المتوقع في هذه الدفعة: $willTry رقم تقريباً\n" +
                    "المدة المتوقعة: $durationText"
            )
            .setPositiveButton("تابع الإرسال") { _, _ ->
                messageEditText.setText(campaign.message)
                startCampaignBatch()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun startCampaignBatch() {
        val campaign = CampaignStore.load(this)
        if (campaign == null) {
            Toast.makeText(this, "لا توجد حملة محفوظة", Toast.LENGTH_LONG).show()
            return
        }

        if (!SmsRoleHelper.isDefaultSmsApp(this)) {
            showDefaultSmsRequiredDialog()
            return
        }

        val delayMs = (getDelaySeconds() ?: 10L) * 1000L
        val contactLimit = getBatchContactLimit() ?: return
        val smsPartLimit = getSmsPartLimit() ?: return

        val serviceIntent = Intent(this, SmsSenderService::class.java).apply {
            action = AppConstants.ACTION_START
            putExtra(AppConstants.EXTRA_MESSAGE, campaign.message)
            putStringArrayListExtra(AppConstants.EXTRA_NUMBERS, campaign.numbers)
            putExtra(AppConstants.EXTRA_DELAY_MS, delayMs)
            putExtra(AppConstants.EXTRA_START_INDEX, campaign.nextIndex)
            putExtra(AppConstants.EXTRA_CONTACT_LIMIT, contactLimit)
            putExtra(AppConstants.EXTRA_SMS_PART_LIMIT, smsPartLimit)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        setRunningState(true)
        statusTextView.text = "الحالة: جاري الإرسال..."
    }

    private fun stopSending() {
        val intent = Intent(this, SmsSenderService::class.java).apply {
            action = AppConstants.ACTION_STOP
        }
        startService(intent)
        stopButton.isEnabled = false
    }

    private fun confirmResetCampaign() {
        val campaign = CampaignStore.load(this)
        if (campaign == null) {
            Toast.makeText(this, "لا توجد حملة محفوظة", Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("تصفير الحملة")
            .setMessage("سيتم حذف تقدم الحملة الحالية. لن يتم حذف جهات الاتصال من هاتفك. هل أنت متأكد؟")
            .setPositiveButton("حذف الحملة") { _, _ ->
                CampaignStore.clear(this)
                updateCampaignStatus()
                Toast.makeText(this, "تم حذف الحملة", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun validateCommonInputs(requireContacts: Boolean): Boolean {
        if (!hasAllPermissions()) {
            requestNeededPermissions()
            Toast.makeText(this, "وافق على الصلاحيات أولاً", Toast.LENGTH_SHORT).show()
            return false
        }

        val message = messageEditText.text.toString().trim()
        if (message.isEmpty()) {
            Toast.makeText(this, "اكتب نص الرسالة أولاً", Toast.LENGTH_SHORT).show()
            return false
        }

        if (requireContacts && loadedNumbers.isEmpty()) {
            Toast.makeText(this, "حمّل الأرقام أولاً", Toast.LENGTH_SHORT).show()
            return false
        }

        if (getDelaySeconds() == null || getBatchContactLimit() == null || getSmsPartLimit() == null) return false
        return true
    }

    private fun getDelaySeconds(): Long? {
        val delaySeconds = delayEditText.text.toString().toLongOrNull() ?: 10L
        if (delaySeconds < 10L) {
            Toast.makeText(this, "أقل تأخير مسموح هو 10 ثواني", Toast.LENGTH_LONG).show()
            delayEditText.setText("10")
            return null
        }
        return delaySeconds
    }

    private fun getBatchContactLimit(): Int? {
        val limit = batchLimitEditText.text.toString().toIntOrNull() ?: 1700
        if (limit < 1) {
            Toast.makeText(this, "حد الأرقام يجب أن يكون 1 أو أكثر", Toast.LENGTH_LONG).show()
            batchLimitEditText.setText("1700")
            return null
        }
        return limit
    }

    private fun getSmsPartLimit(): Int? {
        val limit = smsBudgetEditText.text.toString().toIntOrNull() ?: 1700
        if (limit < 1) {
            Toast.makeText(this, "حد SMS يجب أن يكون 1 أو أكثر", Toast.LENGTH_LONG).show()
            smsBudgetEditText.setText("1700")
            return null
        }
        return limit
    }

    private fun estimateDurationText(count: Int, delaySeconds: Long): String {
        val estimatedMinutes = ceil((count * delaySeconds) / 60.0).toLong()
        val hours = estimatedMinutes / 60
        val minutes = estimatedMinutes % 60
        return if (hours > 0) "$hours ساعة و $minutes دقيقة تقريباً" else "$minutes دقيقة تقريباً"
    }

    private fun updateCampaignStatus() {
        campaignStatusTextView.text = CampaignStore.summaryText(this)
        val campaign = CampaignStore.load(this)
        continueCampaignButton.isEnabled = campaign != null && !campaign.completed && campaign.remainingNumbers > 0
        resetCampaignButton.isEnabled = campaign != null
    }

    private fun setRunningState(running: Boolean) {
        newCampaignButton.isEnabled = !running
        continueCampaignButton.isEnabled = !running && (CampaignStore.load(this)?.let { !it.completed && it.remainingNumbers > 0 } ?: false)
        loadContactsButton.isEnabled = !running
        resetCampaignButton.isEnabled = !running && CampaignStore.load(this) != null
        stopButton.isEnabled = running
        defaultSmsButton.isEnabled = !running
    }


    private fun updateDefaultSmsStatus() {
        val isDefault = SmsRoleHelper.isDefaultSmsApp(this)
        val currentDefault = SmsRoleHelper.currentDefaultSmsPackage(this)
        val previousDefault = prefs.getString("previous_default_sms_package", "").orEmpty()

        defaultSmsStatusTextView.text = if (isDefault) {
            buildString {
                append("الوضع مفعل: هذا التطبيق هو تطبيق SMS الافتراضي الآن.\n")
                append("الرسائل الصادرة من الحملة لن تُضاف من التطبيق إلى صندوق الرسائل المرسلة.\n")
                if (previousDefault.isNotBlank() && previousDefault != packageName) {
                    append("بعد انتهاء الحملة، أعد تطبيقك الأصلي: $previousDefault")
                } else {
                    append("بعد انتهاء الحملة، أعد تطبيق الرسائل الأصلي من الزر بالأسفل.")
                }
            }
        } else {
            "الوضع غير مفعل. التطبيق الافتراضي الحالي: $currentDefault\nلن يبدأ الإرسال حتى تجعل هذا التطبيق تطبيق SMS الافتراضي، حتى لا تُحفظ الرسائل المرسلة في صندوق الرسائل."
        }
    }

    private fun showDefaultSmsRequiredDialog() {
        updateDefaultSmsStatus()
        AlertDialog.Builder(this)
            .setTitle("تفعيل وضع عدم حفظ الرسائل")
            .setMessage(
                "حتى لا تُحفظ الرسائل المرسلة في تطبيق الرسائل، يجب جعل maensat sms sender تطبيق SMS الافتراضي أثناء الحملة.\n\n" +
                    "بعد انتهاء الإرسال، ارجع من نفس الزر واختر تطبيق الرسائل الأصلي مثل Google Messages أو Samsung Messages."
            )
            .setPositiveButton("فتح الاختيار") { _, _ -> SmsRoleHelper.openDefaultSmsAppChooser(this) }
            .setNegativeButton("إلغاء", null)
            .show()
    }

    private fun saveInputs() {
        prefs.edit()
            .putString("message", messageEditText.text.toString())
            .putLong("delay_seconds", delayEditText.text.toString().toLongOrNull() ?: 10L)
            .putInt("batch_contact_limit", batchLimitEditText.text.toString().toIntOrNull() ?: 1700)
            .putInt("sms_part_limit", smsBudgetEditText.text.toString().toIntOrNull() ?: 1700)
            .apply()
    }
}
