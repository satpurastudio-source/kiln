package com.satpurastudio.kiln.baselineprofile

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Launch, add, scroll and open the drawer: the paths people feel on a slow phone. */
@RunWith(AndroidJUnit4::class)
class Generator {
    @get:Rule val rule = BaselineProfileRule()

    @Test fun generate() = rule.collect(packageName = "com.satpurastudio.kiln", maxIterations = 3, stableIterations = 2, includeInStartupProfile = true) {
        pressHome()
        startActivityAndWait()
        fun tap(text: String): Boolean {
            val o = device.wait(Until.findObject(By.textContains(text)), 3000) ?: return false
            o.click()
            device.waitForIdle()
            return true
        }
        // first run: step through to the list as a guest
        if (tap("Skip")) {
            tap("Continue without")
            device.wait(Until.findObject(By.clazz("android.widget.EditText")), 3000)?.text = "Test"
            tap("Continue on this device")
        }
        device.wait(Until.findObject(By.res("android", "permission_allow_button")), 1500)?.click()
        device.wait(Until.findObject(By.descContains("Open menu")), 4000)
        val add = device.wait(Until.findObject(By.textContains("Add a task")), 2000)
        add?.click()
        repeat(8) { i ->
            device.findObject(By.clazz("android.widget.EditText"))?.text = "Task $i today"
            device.pressEnter()
            device.waitForIdle()
        }
        device.pressBack()
        val w = device.displayWidth / 2
        repeat(3) {
            device.swipe(w, device.displayHeight * 3 / 4, w, device.displayHeight / 4, 15)
            device.swipe(w, device.displayHeight / 4, w, device.displayHeight * 3 / 4, 15)
        }
        device.findObject(By.descContains("Open menu"))?.click()
        device.waitForIdle()
        device.findObject(By.textContains("Calendar"))?.click()
        device.waitForIdle()
    }
}

