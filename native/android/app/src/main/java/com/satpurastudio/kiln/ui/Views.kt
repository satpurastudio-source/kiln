@file:OptIn(ExperimentalLayoutApi::class)

package com.satpurastudio.kiln.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.delay

private fun weekdays(skeleton: String) = (0 until 7).map { fmtDate(D.make(2024, 0, 1 + it), skeleton) } // 1 Jan 2024 was a Monday

private fun monthCells(y: Int, m: Int): List<D?> {
    val start = (D.make(y, m, 1).dow + 6) % 7
    val days = D.make(y, m + 1, 0).day
    val out = ArrayList<D?>()
    repeat(start) { out.add(null) }
    for (d in 1..days) out.add(D.make(y, m, d))
    while (out.size % 7 != 0) out.add(null)
    return out
}

@Composable
fun CalendarView() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val deep = s.view.date
    val start = deep?.let(::parseDateStr) ?: D.now
    var y by remember(deep) { mutableIntStateOf(start.year) }
    var m by remember(deep) { mutableIntStateOf(start.month0) }
    var selected by remember(deep) { mutableStateOf(deep ?: todayStr()) }
    var title by remember { mutableStateOf("") }
    var projectId by remember { mutableStateOf<String?>(null) }
    val byDue = remember(s.tasks) { s.tasks.filter { it.due != null && !it.archived }.groupBy { it.due!! } }
    val colors = remember(s.projects) { s.projects.associate { it.id to it.color } }
    val today = todayStr()
    val dayTasks = (byDue[selected] ?: emptyList()).sortedBy { if (it.done) 1 else 0 }
    val selLabel = fmtDate(parseDateStr(selected), "EEEMMMd")
    fun move(delta: Int) {
        val d = D.make(y, m + delta, 1)
        y = d.year
        m = d.month0
    }
    /** Same parsing as the main bar; the date is the selected day unless one is typed. */
    fun add() {
        val st = store.state
        val p = store.parse(title)
        val clean = p.title.trim()
        if (clean.isEmpty()) return
        val due = p.due ?: selected
        val time = p.time ?: st.settings["defaultTime"]?.string?.takeIf { it.isNotEmpty() }
        val prio = p.priority ?: st.settings["defaultPriority"]?.string
        store.dispatch { it.addTask(clean, p.projectId ?: projectId, due, time, prio, p.newFolder) }
        if (due != selected) {
            // jump to where it went so it doesn't look lost
            val d = parseDateStr(due)
            y = d.year
            m = d.month0
            selected = due
        }
        title = ""
        store.sound.add()
    }
    Column {
        Tip("calendar", t("tipCalendar"))
        Row(Modifier.padding(top = 14.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            T("${fmtDate(D.make(y, m, 1), "MMMM")} $y", tok.display(29f), Modifier.weight(1f), maxLines = 1)
            T("‹", tok.ui(20f, c = tok.text2), Modifier.tap(label = t("prevMonth")) { move(-1) }.padding(horizontal = 12.dp, vertical = 6.dp))
            Chip(onClick = {
                y = D.now.year
                m = D.now.month0
                selected = today
            }) { ChipText(t("today")) }
            T("›", tok.ui(20f, c = tok.text2), Modifier.tap(label = t("nextMonth")) { move(1) }.padding(horizontal = 12.dp, vertical = 6.dp))
        }
        Row(Modifier.fillMaxWidth()) {
            weekdays("EEE").forEach { T(it, tok.mono(11f).copy(textAlign = TextAlign.Center), Modifier.weight(1f), maxLines = 1) }
        }
        Column(
            Modifier.padding(top = 4.dp).pointerInput(y, m) {
                var dx = 0f
                detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = { if (Math.abs(dx) > 100f) move(if (dx < 0) 1 else -1) }) { _, d -> dx += d }
            },
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            monthCells(y, m).chunked(7).forEach { week ->
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    week.forEach { date ->
                        if (date == null) Spacer(Modifier.weight(1f).height(52.dp))
                        else {
                            val ds = toDateStr(date)
                            val list = byDue[ds] ?: emptyList()
                            val open = list.filter { !it.done }
                            val past = ds < today
                            Column(
                                Modifier.weight(1f).height(52.dp)
                                    .card(tok, R9, if (ds == selected) tok.accent.copy(alpha = 0.14f) else tok.panel, if (ds == selected) tok.accent.copy(alpha = 0.6f) else tok.border)
                                    .tap { selected = ds },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                T(fmtNum(date.day), tok.ui(13.5f, if (ds == today) FontWeight.Bold else FontWeight.Medium, if (ds == today) tok.accent else if (past) tok.text3 else tok.text))
                                Row(Modifier.height(10.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (list.isNotEmpty() && open.isEmpty()) T("✓", tok.ui(9f, c = tok.text3))
                                    open.take(3).forEach { x -> Box(Modifier.size(5.dp).background(if (past) tok.danger else color(colors[x.projectId] ?: tok.accentHex), CircleShape)) }
                                    if (open.size > 3) T("+${open.size - 3}", tok.ui(8f, c = tok.text3))
                                }
                            }
                        }
                    }
                }
            }
        }
        Row(Modifier.padding(top = 20.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            T(selLabel, tok.ui(13.25f, FontWeight.SemiBold, tok.text2))
            if (selected == today) T(t("todayLower"), tok.mono(11.5f))
            T(if (dayTasks.isEmpty()) t("nothingScheduled") else t("nOpen", "n" to fmtNum(dayTasks.count { !it.done })), tok.mono(11.5f))
        }
        Row(Modifier.fillMaxWidth().heightIn(min = 46.dp).card(tok, RoundedCornerShape(11.dp)).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KIcon("Plus", 12.dp, tok.accent)
            Input(title, { title = it }, t("addTaskFor", "date" to selLabel), tok.ui(14f), Modifier.weight(1f), limit = 120, onDone = { add() })
            FolderMenu(projectId ?: s.projects.firstOrNull()?.id) { projectId = it }
        }
        Column(Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            dayTasks.forEach { x -> key(x.id) { CalendarRow(x) } }
        }
    }
}

@Composable
private fun CalendarRow(task: KTask) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val p = store.state.projects.firstOrNull { it.id == task.projectId }
    Row(Modifier.fillMaxWidth().card(tok).padding(end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        CheckCircle(task.done, color(p?.color ?: tok.accentHex)) {
            if (task.done) {
                store.dispatch { it.toggleTask(task.id) }
                store.sound.pop()
            } else {
                store.sound.complete()
                store.completeWithFlourish(task)
            }
        }
        Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
            T(task.title, tok.ui(15f, FontWeight.Medium, if (task.done) tok.text3 else tok.text).copy(textDecoration = if (task.done) TextDecoration.LineThrough else null), maxLines = 1)
            if (p != null) T(p.name + (task.time?.let { " · ${fmtTime(it)}" } ?: ""), tok.ui(12f, c = tok.text3), maxLines = 1)
        }
        if (!task.done) IconBtn("Play", t("focusOnTask"), 11.dp, tok.text3) { store.startFocus(task.id) }
        IconBtn("X", t("deleteTask"), 11.dp, tok.text3) { store.remove(task) }
    }
}

/** Floating peek calendar, bottom-right. A day opens the full calendar view. */
@Composable
fun MiniCalendarLauncher() {
    val store = LocalStore.current
    val tok = LocalTok.current
    var open by remember { mutableStateOf(false) }
    var y by remember { mutableIntStateOf(D.now.year) }
    var m by remember { mutableIntStateOf(D.now.month0) }
    fun pick(ds: String) {
        store.dispatch { it.copy(view = Screen("calendar", date = ds)) }
        open = false
    }
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).imePadding(), contentAlignment = Alignment.BottomEnd) {
        if (open) Box(Modifier.fillMaxSize().tap { open = false })
        AnimatedVisibility(open, Modifier.padding(end = 18.dp, bottom = 76.dp), enter = fadeIn(), exit = fadeOut()) {
            val due = remember(store.state.tasks) { store.state.tasks.filter { !it.done }.mapNotNull { it.due }.toSet() }
            Column(Modifier.width(250.dp).card(tok, RoundedCornerShape(16.dp), tok.raise).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    fun step(d: Int) {
                        val x = D.make(y, m + d, 1)
                        y = x.year
                        m = x.month0
                    }
                    T("‹", tok.ui(18f, c = tok.text2), Modifier.tap(label = t("prevMonth")) { step(-1) }.padding(horizontal = 14.dp, vertical = 4.dp))
                    T("${fmtDate(D.make(y, m, 1), "MMM")} $y", tok.ui(13f, FontWeight.SemiBold).copy(textAlign = TextAlign.Center), Modifier.weight(1f))
                    T("›", tok.ui(18f, c = tok.text2), Modifier.tap(label = t("nextMonth")) { step(1) }.padding(horizontal = 14.dp, vertical = 4.dp))
                }
                Row {
                    weekdays("EEEEE").forEach { T(it, tok.mono(10f).copy(textAlign = TextAlign.Center), Modifier.weight(1f), maxLines = 1) }
                }
                monthCells(y, m).chunked(7).forEach { week ->
                    Row {
                        week.forEach { date ->
                            if (date == null) Spacer(Modifier.weight(1f).height(30.dp))
                            else {
                                val ds = toDateStr(date)
                                val isNow = ds == todayStr()
                                Box(
                                    Modifier.weight(1f).height(30.dp).background(if (isNow) tok.accent else Color.Transparent, R9).tap { pick(ds) },
                                    contentAlignment = Alignment.Center,
                                ) { T(date.day.toString(), tok.ui(12f, if (isNow) FontWeight.Bold else FontWeight.Normal, if (isNow) Color.White else if (ds in due) tok.accent else tok.text2)) }
                            }
                        }
                    }
                }
                T(t("openFullCalendar"), tok.ui(12.5f, FontWeight.Medium, tok.accent), Modifier.tap { pick(todayStr()) }.padding(top = 6.dp, bottom = 2.dp))
            }
        }
        Box(
            Modifier.padding(18.dp).size(46.dp).background(tok.raise, CircleShape).border(1.dp, tok.border, CircleShape).tap(label = t("openMiniCalendar")) { open = !open },
            contentAlignment = Alignment.Center,
        ) {
            KIcon("Calendar", 20.dp)
            T(D.now.day.toString(), tok.ui(8f, FontWeight.Bold, tok.accent), Modifier.padding(top = 5.dp))
        }
    }
}

@Composable
fun InsightsView() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val stats = remember(s.stats, s.projects, store.day) { s.insights }
    val days14 = remember(store.day) { (13 downTo 0).map { addDaysStr(-it) } }
    var name by remember { mutableStateOf("") }
    var hue by remember { mutableStateOf(HABIT_COLORS[0]) }
    fun addHabit() {
        if (name.isBlank()) return
        store.dispatch { it.addHabit(name, hue) }
        name = ""
        store.toast(t("habitAdded"), "✦")
    }
    @Composable
    fun heading(icon: String, text: String) {
        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            KIcon(icon, 15.dp, tok.accent)
            T(text, tok.ui(15f, FontWeight.SemiBold))
        }
    }
    @Composable
    fun RowScope.stat(label: String, value: String, flame: Boolean = false) {
        Column(Modifier.weight(1f).card(tok).padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                if (flame) FlameMark(15.dp, tok.accent, 1.5f)
                T(value, tok.display(29f), maxLines = 1)
            }
            T(label, tok.ui(12f, c = tok.text3), maxLines = 2)
        }
    }
    Column(Modifier.padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        Tip("insights", t("tipInsights"))
        heading("Target", t("habits"))
        KField(name, { name = it }, t("newHabitPh"), limit = 40, onDone = { addHabit() })
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            HABIT_COLORS.forEach { c ->
                Box(
                    Modifier.size(26.dp).background(color(c), CircleShape).border(2.dp, if (hue == c) tok.text else Color.Transparent, CircleShape).tap(label = t("useColor", "color" to c)) { hue = c },
                )
            }
            Spacer(Modifier.weight(1f))
            PrimaryButton("＋ ${t("add")}", onClick = ::addHabit)
        }
        if (s.habits.isEmpty()) BareEmpty("Target", t("habitsEmpty"))
        s.habits.forEach { h -> key(h.id) { HabitRow(h, days14) } }
        heading("Chart", t("thisWeek"))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            stat(t("doneThisWeek"), fmtNum(stats.totalWeek))
            stat(t("dayStreak"), fmtNum(stats.streak), stats.streak > 0)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            stat(t("focusSessions"), fmtNum(stats.totalPomos))
            stat(t("bestDay"), if (stats.bestDay.count > 0) stats.bestDay.label else "—")
        }
        Row(Modifier.fillMaxWidth().height(170.dp).card(tok).padding(14.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            stats.days.forEach { d ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    if (d.count > 0) T(fmtNum(d.count), tok.mono(11f, c = tok.text2))
                    Box(Modifier.fillMaxWidth().height((3 + 100f * d.count / stats.maxDay).dp).background(Brush.verticalGradient(listOf(tok.accent2, tok.accent)), RoundedCornerShape(5.dp)))
                    T(d.label, tok.mono(10.5f), maxLines = 1)
                }
            }
        }
        stats.byFolder.firstOrNull()?.let { top ->
            T(t("byFolder"), tok.ui(12.5f, FontWeight.SemiBold, tok.text2))
            stats.byFolder.forEach { f ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    T(f.name, tok.ui(12.5f, c = tok.text2), Modifier.width(96.dp), maxLines = 1)
                    Box(Modifier.weight(1f).height(6.dp).background(tok.border, CircleShape)) {
                        Box(Modifier.fillMaxWidth(f.count.toFloat() / top.count).fillMaxHeight().background(color(f.color), CircleShape))
                    }
                    T(fmtNum(f.count), tok.mono(11.5f))
                }
            }
        }
        stats.bestHour?.let { h ->
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                KIcon("Clock", 12.dp)
                T("${t("bestHour")} ${fmtHour(h)}", tok.ui(13f, c = tok.text2))
            }
        }
    }
}

@Composable
private fun HabitRow(h: Habit, days: List<String>) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val today = todayStr()
    val done = h.doneOn(today)
    val c = color(h.color)
    Row(Modifier.fillMaxWidth().card(tok).padding(start = 11.dp, top = 7.dp, bottom = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Box(
            Modifier.size(28.dp).background(if (done) c else Color.Transparent, CircleShape).border(1.6.dp, c, CircleShape)
                .tap(label = if (done) t("markNotDoneToday") else t("markDoneToday")) { store.dispatch { it.toggleHabit(h.id) } },
            contentAlignment = Alignment.Center,
        ) { if (done) T("✓", tok.ui(13f, FontWeight.Bold, Color.White)) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                T(h.name, tok.ui(14f, FontWeight.Medium), maxLines = 1)
                if (h.streak > 0) {
                    FlameMark(11.dp, c, 1f)
                    T(fmtNum(h.streak), tok.mono(11.5f, c = c))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                days.forEach { d -> Box(Modifier.size(11.dp).background(if (h.doneOn(d)) c else tok.border, RoundedCornerShape(2.dp))) }
            }
        }
        IconBtn("X", t("removeHabit"), 11.dp, tok.text3) {
            store.dispatch { st -> st.copy(habits = st.habits.filter { it.id != h.id }) }
            store.toast(t("habitRemoved"), "🗑")
        }
    }
}

fun fmtClock(secs: Double): String {
    val s = maxOf(0, Math.ceil(secs).toInt())
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
}

/** Recomposes its content every interval, only while it's on screen. */
@Composable
fun rememberTick(ms: Long): Int {
    var n by remember { mutableIntStateOf(0) }
    LaunchedEffect(ms) {
        while (true) {
            delay(ms)
            n++
        }
    }
    return n
}

/** The pomodoro overlay and its pill. Nothing ticks while there's no session. */
@Composable
fun FocusLayer() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val f = store.focus ?: return
    val moss = Color(0xFF7C8A4D)
    if (store.focusOpen) {
        Box(Modifier.fillMaxSize().background(tok.scrim).tap {}, contentAlignment = Alignment.Center) { FocusCard(f) }
    } else {
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).imePadding().padding(18.dp), contentAlignment = Alignment.BottomStart) {
            rememberTick(1000)
            Row(
                Modifier.height(44.dp).background(tok.raise, CircleShape).border(1.dp, tok.border, CircleShape).tap(label = t("openFocus")) { store.focusOpen = true }.padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Box(Modifier.size(8.dp).background(if (f.phase == "work") tok.accent else moss, CircleShape))
                T(fmtClock(store.focusSecondsLeft), tok.mono(13f, true, tok.text))
                T(if (f.phase == "work") t("focusLower") else t("breakLower"), tok.ui(12.5f, c = tok.text2))
            }
        }
    }
}

@Composable
private fun FocusCard(session: FocusSession) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val task = s.tasks.firstOrNull { it.id == session.taskId }
    val mode = focusDurations(session.mode, s.settings)
    val isWork = session.phase == "work"
    val duration = (if (isWork) mode.work else if (session.count % 4 == 0 && session.count > 0) mode.brk * 3 else mode.brk).toDouble()
    val running = session.remaining == null
    val moss = Color(0xFF7C8A4D)
    val tint = if (isWork) tok.accent else moss
    fun setMode(id: String) {
        val m = focusDurations(id, store.state.settings)
        val dur = (if (isWork) m.work else m.brk).toDouble()
        store.updateFocus(session.copy(mode = id, endsAt = Clock.ms + dur * 1000, remaining = if (session.remaining != null) dur else null))
    }
    fun end() {
        store.updateFocus(null)
        store.focusOpen = false
        store.sound.pop()
    }
    Column(
        Modifier.widthIn(max = 430.dp).padding(16.dp).fillMaxWidth().card(tok, RoundedCornerShape(20.dp), tok.raise).padding(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Tip("focus", t("tipFocus"))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            T(if (isWork) "⚒ ${t("focusLower")}" else "☕ ${t("breakLower")}", tok.mono(12.5f, true, tint), Modifier.weight(1f), maxLines = 1)
            IconBtn("X", t("minimize"), 12.dp) { store.focusOpen = false }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip(session.mode == "classic", { setMode("classic") }) { ChipText("25 · 5", session.mode == "classic") }
            Chip(session.mode == "deep", { setMode("deep") }) { ChipText("50 · 10", session.mode == "deep") }
            Chip(session.mode == "custom", { setMode("custom") }) { ChipText(t("accentCustom"), session.mode == "custom") }
        }
        if (session.mode == "custom") {
            @Composable
            fun stepper(label: String, key: String, hi: Int) {
                val v = (s.settings[key]?.number ?: 1.0).toInt().coerceIn(1, hi)
                fun set(n: Int) {
                    store.dispatch { it.setSettings(itemOf(key to n.coerceIn(1, hi).j())) }
                    setMode("custom")
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MiniButton("−") { set(v - 1) }
                    T("$label ${fmtNum(v)} ${t("minUnit")}", tok.ui(12.5f, c = tok.text2))
                    MiniButton("+") { set(v + 1) }
                }
            }
            stepper(t("widget_focus"), "focusWork", 180)
            stepper(t("break"), "focusBreak", 60)
        }
        rememberTick(500)
        val left = store.focusSecondsLeft
        Box(Modifier.size(224.dp), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val w = 6.dp.toPx()
                val sz = Size(size.width - w, size.height - w)
                drawArc(tok.border, 0f, 360f, false, Offset(w / 2, w / 2), sz, style = Stroke(w))
                drawArc(tint, -90f, 360f * (left / duration).coerceIn(0.0, 1.0).toFloat(), false, Offset(w / 2, w / 2), sz, style = Stroke(w, cap = StrokeCap.Round))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                T(fmtClock(left), tok.mono(44f, true, tok.text))
                T(task?.title ?: t("focusSession"), tok.ui(13f, c = tok.text2).copy(textAlign = TextAlign.Center), Modifier.widthIn(max = 170.dp), maxLines = 2)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            repeat(4) { i ->
                val lit = i < session.count % 4 || (session.count > 0 && session.count % 4 == 0)
                FlameMark(13.dp, if (lit) tok.accent else tok.borderStrong, 1.2f)
            }
            if (session.count > 0) T(t("nDone", "n" to fmtNum(session.count)), tok.mono(11.5f))
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            IconBtn("Skip", t("skipPhase"), 17.dp) {
                val m = focusDurations(session.mode, store.state.settings)
                val next = if (isWork) session.copy(phase = "break", endsAt = Clock.ms + m.brk * 1000.0, remaining = null) else session.copy(phase = "work", endsAt = Clock.ms + m.work * 1000.0, remaining = null)
                store.updateFocus(next)
                store.sound.pop()
            }
            Box(
                Modifier.size(60.dp).background(tok.accent, CircleShape).tap {
                    val l = store.focusSecondsLeft
                    if (running) store.updateFocus(session.copy(remaining = l)) else store.updateFocus(session.copy(remaining = null, endsAt = Clock.ms + l * 1000))
                },
                contentAlignment = Alignment.Center,
            ) { KIcon(if (running) "Pause" else "Play", 22.dp, Color.White) }
            IconBtn("X", t("endSession"), 16.dp, onClick = ::end)
        }
        if (task != null && !task.done) {
            val name = if (task.title.length > 34) task.title.take(34) + "…" else task.title
            T("✓ ${t("completeNamed", "title" to name)}", tok.ui(13f, FontWeight.Medium, tok.text2), Modifier.tap {
                store.dispatch { it.toggleTask(task.id) }
                store.sound.fanfare()
                store.toast(t("taskForged"), "✓")
                end()
            }.padding(6.dp))
        }
    }
}
