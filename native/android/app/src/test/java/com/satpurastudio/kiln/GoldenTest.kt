package com.satpurastudio.kiln

import com.satpurastudio.kiln.core.*
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/** Everything here was computed by the web app's own JavaScript (native/scripts/gen-shared.mjs). */
class GoldenTest {
    private fun fixture(name: String): J {
        // Gradle runs tests from the module directory
        val f = listOf("../../shared/fixtures/$name.json", "../shared/fixtures/$name.json").map(::File).first { it.exists() }
        return J.parse(f.readText())!!
    }

    private fun at(f: J) {
        val n = f["now"]!!.array!!.map { it.number!!.toInt() }
        Clock.override = D.make(n[0], n[1] - 1, n[2], n[3], n[4]).ms
    }

    @After fun reset() {
        Clock.override = null
    }

    @Test fun stable() {
        for (c in fixture("stable")["cases"]!!.array!!) assertEquals(c["json"]!!.string, c["value"]!!.stable)
    }

    @Test fun parse() {
        val f = fixture("parse")
        at(f)
        val projects = f["projects"]!!.array!!.map { it["id"]!!.string!! to it["name"]!!.string!! }
        for (c in f["cases"]!!.array!!) {
            val input = c["input"]!!.string!!
            val o = c["output"]!!
            val want = Parsed(o["title"]!!.string!!, o["projectId"]?.string, o["newFolder"]?.string, o["priority"]?.string, o["time"]?.string, o["due"]?.string)
            assertEquals("input: $input", want, parseQuickAdd(input, projects))
        }
    }

    @Test fun nextDueCases() {
        val f = fixture("nextDue")
        at(f)
        for (c in f["cases"]!!.array!!) assertEquals(c.stable, c["next"]!!.string, nextDue(c["due"]?.string, c["repeat"]!!.string!!))
    }

    @Test fun misc() {
        val f = fixture("misc")
        at(f)
        for (c in f["times"]!!.array!!) assertEquals(c["label"]!!.string, fmtTime(c["value"]!!.string!!))
        for (c in f["accents"]!!.array!!) {
            val hex = c["hex"]!!.string!!
            val a = deriveAccent(hex)
            assertEquals(hex, c["accent2"]!!.string, a.accent2)
            assertEquals(hex, c["deep"]!!.string, a.deep)
            val (r, g, b) = hexRGB(hex)
            assertEquals(c["rgb"]!!.string, "$r, $g, $b")
        }
        for (c in f["habits"]!!.array!!) assertEquals(c.stable, c["streak"]!!.number!!.toInt(), Habit(itemOf("log" to c["log"]!!)).streak)
    }

    @Test fun merge() {
        for (c in fixture("merge")["cases"]!!.array!!) {
            val got = mergeSnapshots(Snapshot.of(c["base"]), Snapshot.of(c["local"]), Snapshot.of(c["remote"]))
            assertEquals(c["name"]!!.string, Snapshot.of(c["merged"]).fingerprint, got.fingerprint)
        }
    }

    @Test fun backup() {
        val f = fixture("backup")
        val got = parseBackup(f["input"]!!.string!!)
        val want = Snapshot.of(f["output"])
        assertEquals(want.projects, got.projects)
        assertEquals(want.tasks, got.tasks)
        assertEquals(want.habits, got.habits)
    }
}
