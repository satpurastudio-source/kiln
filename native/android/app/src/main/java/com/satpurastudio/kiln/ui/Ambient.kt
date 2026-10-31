package com.satpurastudio.kiln.ui

import android.app.Activity
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private fun Item.num(k: String) = this[k]?.number ?: 0.0
private fun Item.int(k: String) = num(k).toInt()
private fun Item.str(k: String) = this[k]?.string ?: ""
private fun Item.flag(k: String) = this[k]?.boolean ?: false

/** A calm always-on screen: clock, today's board, and Ember. */
@Composable
fun AmbientScreen(customize: Boolean, onExit: () -> Unit) {
    val store = LocalStore.current
    val base = LocalTok.current
    val context = LocalContext.current
    val s = store.state
    val cfg = s.ambient
    var editing by remember { mutableStateOf(customize) }
    var adding by remember { mutableStateOf(false) }
    var controls by remember { mutableStateOf(false) }
    var poke by remember { mutableIntStateOf(0) }
    var tab by remember { mutableStateOf("todo") }
    var drift by remember { mutableStateOf(Offset.Zero) }
    var now by remember { mutableStateOf(D.now) }

    BackHandler {
        if (adding) adding = false else if (editing) editing = false else onExit()
    }
    // the screen stays on here, and only here
    DisposableEffect(Unit) {
        val w = (context as? Activity)?.window
        w?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { w?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }
    // the board and Ember's mood only need the minute
    LaunchedEffect(Unit) {
        while (true) {
            delay(60000 - Clock.ms % 60000 + 20)
            now = D.now
        }
    }
    val driftAmount = cfg.num("drift").toFloat()
    // burn-in protection: nudge the whole layout a little every 3 minutes
    LaunchedEffect(driftAmount) {
        if (driftAmount <= 0f) drift = Offset.Zero
        else while (true) {
            delay(180_000)
            drift = Offset((Math.random() * driftAmount).toFloat(), (Math.random() * driftAmount).toFloat())
        }
    }
    LaunchedEffect(poke) {
        if (poke > 0) {
            controls = true
            delay(2600)
            controls = false
        }
    }
    val night = cfg.str("night") != "off" && isNightHour(now, cfg.int("nightStart"), cfg.int("nightEnd"))
    val forced = if (night && cfg.str("night") == "dark") "dark" else if (cfg.str("theme") == "app") null else cfg.str("theme")
    val tok = if (forced != null) base.copy(dark = forced == "dark") else base

    CompositionLocalProvider(LocalTok provides tok) {
        BoxWithConstraints(Modifier.fillMaxSize().background(tok.bg).tap { poke++ }) {
            val mw = maxWidth
            val mh = maxHeight
            val compact = mw <= 700.dp || mh <= 500.dp
            val landscape = mw > mh
            Canvas(Modifier.fillMaxSize()) {
                val c = Offset(size.width * (if (cfg.str("side") == "left") 0.2f else 0.8f), size.height * 0.5f)
                drawRect(Brush.radialGradient(listOf(tok.accent.copy(alpha = (0.14 * cfg.num("glow") / 100).toFloat().coerceIn(0f, 1f)), Color.Transparent), c, maxOf(size.width, size.height) * 0.6f))
            }
            Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).graphicsLayer { translationX = drift.x; translationY = drift.y }) {
                if (compact) {
                    if (landscape) {
                        val clock = minOf(mh - 110.dp, mw * 0.34f).coerceAtLeast(110.dp)
                        Row(Modifier.fillMaxSize().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
                            Left(cfg, clock, now, widgets = false)
                            Right(cfg, now, true, tab, { tab = it }, ((mh.value - 170) / (cfg.num("rowSize") + 26)).toInt().coerceIn(1, cfg.int("maxRows")), Modifier.weight(1f))
                        }
                    } else {
                        val clock = minOf(mw - 110.dp, mh * 0.28f).coerceAtLeast(110.dp)
                        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Left(cfg, clock, now, widgets = true)
                            Right(cfg, now, true, tab, { tab = it }, ((mh.value - clock.value - 330) / (cfg.num("rowSize") + 26)).toInt().coerceIn(1, cfg.int("maxRows")), Modifier.weight(1f))
                        }
                    }
                } else if (mw < 1000.dp) {
                    // too narrow to sit side by side without squeezing the tasks (a tablet held upright)
                    val clock = minOf(cfg.num("clockSize").dp, minOf(mw * 0.5f, mh * 0.36f)).coerceAtLeast(160.dp)
                    Column(Modifier.fillMaxSize().padding(cfg.num("padding").dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(32.dp)) {
                        Left(cfg, clock, now, true)
                        Right(cfg, now, false, tab, { tab = it }, cfg.int("maxRows"), Modifier.weight(1f))
                    }
                    if (cfg.flag("showEmber")) {
                        Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = if (cfg.str("emberCorner") == "left") Alignment.BottomStart else Alignment.BottomEnd) { Ember(cfg.num("emberSize").dp, now) }
                    }
                } else {
                    val pad = cfg.num("padding").dp
                    val clock = minOf(cfg.num("clockSize").dp, minOf(mw * 0.42f, mh - pad * 2 - 170.dp)).coerceAtLeast(160.dp)
                    Row(Modifier.fillMaxSize().padding(pad), horizontalArrangement = Arrangement.spacedBy(cfg.num("gap").dp), verticalAlignment = Alignment.CenterVertically) {
                        if (cfg.str("side") == "left") Left(cfg, clock, now, true)
                        Right(cfg, now, false, tab, { tab = it }, cfg.int("maxRows"), Modifier.weight(1f))
                        if (cfg.str("side") != "left") Left(cfg, clock, now, true)
                    }
                    if (cfg.flag("showEmber")) {
                        Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = if (cfg.str("emberCorner") == "left") Alignment.BottomStart else Alignment.BottomEnd) { Ember(cfg.num("emberSize").dp, now) }
                    }
                }
            }
            if (night) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = (1 - cfg.num("nightLevel") / 100).toFloat().coerceIn(0f, 1f))))
            if (controls || editing) {
                Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)) {
                    @Composable
                    fun ctl(icon: String, label: String, on: Boolean, f: () -> Unit) {
                        Box(
                            Modifier.size(42.dp).background(if (on) tok.accent else tok.raise.copy(alpha = 0.85f), CircleShape).border(1.dp, tok.border, CircleShape).tap(label = label, onClick = f),
                            contentAlignment = Alignment.Center,
                        ) { KIcon(icon, 16.dp, if (on) Color.White else tok.text2) }
                    }
                    if (cfg.flag("quickAdd")) ctl("Plus", t("addTask"), adding) { adding = !adding }
                    ctl("Settings", t("customizeAmbient"), editing) { editing = !editing }
                    ctl("X", t("exitAmbient"), false, onExit)
                }
            }
            if (adding) AmbientQuickAdd { adding = false }
            if (editing) {
                Row(Modifier.fillMaxSize()) {
                    Spacer(Modifier.weight(1f))
                    AmbientEditor(cfg, Modifier.widthIn(max = 400.dp).fillMaxWidth(if (compact) 1f else 0.45f)) { editing = false }
                }
            }
        }
    }
}

@Composable
private fun Left(cfg: Item, clock: Dp, now: D, widgets: Boolean) {
    val tok = LocalTok.current
    val store = LocalStore.current
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AnalogClock(cfg.str("clockFace"), cfg.str("seconds"), store.state.reducedEffects, Modifier.size(clock))
        if (cfg.flag("showDate") || cfg.flag("showDigital")) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (cfg.flag("showDate")) T(dateLabel(now), tok.mono(14f, true, tok.text2))
                if (cfg.flag("showDigital")) T("${now.hour.toString().padStart(2, '0')}:${now.minute.toString().padStart(2, '0')}", tok.mono(14f, c = tok.accent))
            }
        }
        if (widgets) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Widget(cfg.str("widget1"))
                Widget(cfg.str("widget2"))
            }
        }
    }
}

private fun dateLabel(d: D): String {
    if (I18n.lang != "en") return fmtDate(d, "EEEdMMM")
    val wd = listOf("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
    val mo = listOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
    return "${wd[d.dow]} ${d.day.toString().padStart(2, '0')} ${mo[d.month0]}"
}

/** A widget with nothing worth showing stays hidden: an idle box is just noise. */
@Composable
private fun Widget(kind: String) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    @Composable
    fun card(label: String, content: @Composable RowScope.() -> Unit) {
        Column(Modifier.card(tok).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            T(label.uppercase(), tok.mono(10.5f, true))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = content)
        }
    }
    when (kind) {
        "streak" -> {
            val streak = s.insights.streak
            if (streak > 0) card(t("ambStreak")) {
                FlameMark(22.dp, tok.accent, 1.8f)
                T(tn("days", streak), tok.ui(16f, FontWeight.SemiBold))
            }
        }
        "progress" -> card(t("ambToday")) {
            ProgressRing(34.dp, 4.dp, s.todayProgress.pct.toFloat())
            T("${s.todayProgress.pct}%", tok.ui(16f, FontWeight.SemiBold))
        }
        "focus" -> store.focus?.let { f ->
            val work = f.phase == "work"
            val m = focusDurations(f.mode, s.settings)
            val dur = (if (work) m.work else if (f.count % 4 == 0 && f.count > 0) m.brk * 3 else m.brk).toDouble()
            rememberTick(1000)
            val left = store.focusSecondsLeft
            card(if (work) t("ambFocus") else t("ambBreak")) {
                ProgressRing(34.dp, 4.dp, (left / dur * 100).coerceIn(0.0, 100.0).toFloat(), if (work) tok.accent else Color(0xFF7C8A4D))
                Column {
                    T(fmtClock(left), tok.mono(15f, true, tok.text))
                    T(s.tasks.firstOrNull { it.id == f.taskId }?.title ?: t("focusSession"), tok.ui(11.5f, c = tok.text3), Modifier.widthIn(max = 120.dp), maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun Right(cfg: Item, now: D, compact: Boolean, tab: String, setTab: (String) -> Unit, rows: Int, modifier: Modifier) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val active = s.tasks.filter { !it.done && !it.archived && (isToday(it.due) || isOverdue(it.due)) }
        .sortedWith(compareBy({ if (isOverdue(it.due)) 0 else 1 }, { it.time ?: "99:99" }, { priorityRank[it.priority] ?: 3 }))
    val done = s.tasks.filter { x -> x.done && !x.archived && (x.doneAt?.let { sameDay(it, now) } ?: false) }.sortedByDescending { it.doneAt ?: 0.0 }
    val p = s.todayProgress
    val first = s.profile?.get("name")?.string?.trim()?.split(Regex("\\s+"))?.firstOrNull()?.takeIf { it.isNotEmpty() }
    val onlyTodo = cfg.str("columns") == "todo"
    @Composable
    fun colHead(label: String, n: Int, dot: Color) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Box(Modifier.size(7.dp).background(dot, CircleShape))
            T(label, tok.mono(12f, true, tok.text2))
            T(fmtNum(n), tok.mono(12f))
        }
    }
    @Composable
    fun column(list: List<KTask>, finished: Boolean) {
        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            if (list.isEmpty()) T(if (finished) t("nothingFinished") else t("ember_sleepy_0"), tok.ui(14f, c = tok.text3), Modifier.padding(vertical = 10.dp))
            list.take(maxOf(1, rows)).forEach { x ->
                key(x.id) {
                    Row(
                        Modifier.fillMaxWidth().card(tok, RoundedCornerShape(cfg.num("radius").dp)).padding(end = 10.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        CheckCircle(finished, tok.accent) { store.dispatch { it.toggleTask(x.id) } }
                        if (!finished && isOverdue(x.due)) Box(Modifier.size(6.dp).background(tok.danger, CircleShape))
                        T(x.title, tok.ui(cfg.num("rowSize").toFloat() * 0.72f / tok.scale, FontWeight.Medium, if (finished) tok.text3 else tok.text).copy(textDecoration = if (finished) TextDecoration.LineThrough else null), Modifier.weight(1f), maxLines = 1)
                        if (!finished) {
                            x.time?.let { T(fmtTime(it), tok.mono(11.5f), maxLines = 1) }
                            if (x.priority != "none") T(t("prio_${x.priority}"), tok.ui(11f, FontWeight.Medium, color(priorityColors[x.priority] ?: "#5f7c8a")), maxLines = 1)
                        }
                    }
                }
            }
            if (list.size > rows) T(t("nMore", "n" to fmtNum(list.size - maxOf(1, rows))), tok.mono(12f))
        }
    }
    Column(modifier.fillMaxWidth().clipToBounds(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (cfg.flag("showGreeting")) T("${greeting()}${first?.let { ", $it" } ?: ""}.", tok.display(if (compact) 31f else 43f), maxLines = 2)
                if (cfg.flag("showProgress")) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.weight(1f).height(5.dp).background(tok.border, CircleShape)) {
                            Box(Modifier.fillMaxWidth(p.pct / 100f).fillMaxHeight().background(tok.accent, CircleShape))
                        }
                        T("${p.done}/${p.total} · ${p.pct}%", tok.mono(12f), maxLines = 1)
                    }
                }
            }
            if (compact && cfg.flag("showEmber")) Ember(minOf(cfg.num("emberSize"), 52.0).dp, now)
        }
        if (compact) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Triple("todo", t("colTodo"), active.size), Triple("done", t("colDone"), done.size)).filter { !(onlyTodo && it.first == "done") }.forEach { (id, label, n) ->
                    val on = (if (onlyTodo) "todo" else tab) == id
                    Box(
                        Modifier.heightIn(min = 34.dp).background(if (on) tok.panelHover else Color.Transparent, CircleShape).border(1.dp, if (on) tok.border else Color.Transparent, CircleShape).tap { setTab(id) }.padding(horizontal = 10.dp),
                        contentAlignment = Alignment.Center,
                    ) { colHead(label, n, if (id == "todo") tok.accent else Color(0xFF6F9B7A)) }
                }
            }
            val showDone = tab == "done" && !onlyTodo
            column(if (showDone) done else active, showDone)
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    colHead(t("colTodo"), active.size, tok.accent)
                    column(active, false)
                }
                if (!onlyTodo) Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    colHead(t("colDone"), done.size, Color(0xFF6F9B7A))
                    column(done, true)
                }
            }
        }
    }
}

@Composable
private fun AnalogClock(face: String, seconds: String, still: Boolean, modifier: Modifier) {
    val tok = LocalTok.current
    val measurer = rememberTextMeasurer()
    // sweep draws smoothly, but tick and off wake once a second or less, and reduced effects once a minute
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(seconds, still) {
        if (!still && seconds == "sweep") {
            while (true) withFrameMillis { nowMs = System.currentTimeMillis() }
        } else {
            val step = if (still) 60_000L else if (seconds == "tick") 1000L else 15_000L
            while (true) {
                nowMs = System.currentTimeMillis()
                delay(step - nowMs % step)
            }
        }
    }
    Canvas(modifier) {
        val k = size.minDimension / 200f
        fun hand(deg: Float, from: Float, to: Float, w: Float, c: Color) {
            rotate(deg, Offset(100 * k, 100 * k)) {
                drawLine(c, Offset(100 * k, from * k), Offset(100 * k, to * k), w * k, StrokeCap.Round)
            }
        }
        val center = Offset(100 * k, 100 * k)
        drawCircle(if (tok.dark) Color.White.copy(alpha = 0.03f) else Color.White.copy(alpha = 0.75f), 97 * k, center)
        drawCircle(tok.borderStrong, 97 * k, center, style = Stroke(1.2f * k))
        for (i in 0 until 60) {
            val hour = i % 5 == 0
            val quarter = i % 15 == 0
            if (face == "minimal" && !hour) continue
            if (face == "numerals" && quarter) continue
            hand(i * 6f, if (quarter) 10f else if (hour) 12f else 14f, if (quarter) 26f else if (hour) 23f else 18f, if (quarter) 2.4f else if (hour) 1.6f else 0.8f, if (hour) tok.text2 else tok.text3)
        }
        if (face == "numerals") {
            listOf(Triple("12", 100f, 34f), Triple("3", 166f, 100f), Triple("6", 100f, 166f), Triple("9", 34f, 100f)).forEach { (n, x, y) ->
                val l = measurer.measure(n, tok.display(20f * k / density, tok.text2))
                drawText(l, topLeft = Offset(x * k - l.size.width / 2f, y * k - l.size.height / 2f))
            }
        }
        val d = D(nowMs)
        val sec = d.second + if (still) 0f else (nowMs % 1000) / 1000f
        val min = d.minute + if (still) 0f else sec / 60f
        val hr = d.hour % 12 + d.minute / 60f
        hand(hr * 30f, 112f, 56f, 6f, tok.text)
        hand(min * 6f, 114f, 28f, 4f, tok.text)
        if (seconds != "off") hand((if (seconds == "tick") Math.floor(sec.toDouble()).toFloat() else sec) * 6f, 124f, 20f, 1.4f, tok.accent)
        drawCircle(tok.text, 5.5f * k, center)
        drawCircle(tok.accent, 2f * k, center)
    }
}

/** kiln's flame, brought to life. Mood comes from the app's state. */
@Composable
private fun Ember(size: Dp, now: D) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val scope = rememberCoroutineScope()
    val s = store.state
    val mood = s.emberMood(store.focus, now.ms)
    val streak = s.insights.streak
    val scale = 0.85f + minOf(streak, 14) * 0.02f
    var line by remember { mutableStateOf("") }
    val spark = remember { Animatable(1f) }
    var squash by remember { mutableStateOf(false) }
    var blink by remember { mutableStateOf(false) }
    val sx by animateFloatAsState(if (squash) 1.12f else 1f, spring(0.45f))
    val sy by animateFloatAsState(if (squash) 0.84f else 1f, spring(0.45f))
    LaunchedEffect(mood, s.reducedEffects) {
        if (mood == "idle" && !s.reducedEffects) while (true) {
            delay((5000..9000).random().toLong())
            blink = true
            delay(140)
            blink = false
        }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (line.isNotEmpty()) T(line, tok.ui(12.5f), Modifier.widthIn(max = 220.dp).card(tok, RoundedCornerShape(11.dp), tok.raise).padding(horizontal = 11.dp, vertical = 7.dp))
        Canvas(
            Modifier.size(size).graphicsLayer {
                scaleX = sx * scale
                scaleY = sy * scale
                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
            }.tap(label = "Ember") {
                squash = true
                if (!s.reducedEffects) scope.launch {
                    spark.snapTo(0f)
                    spark.animateTo(1f, tween(550))
                }
                val pool = (0..2).map { t("ember_${mood}_$it") }.toMutableList()
                val overdue = store.state.tasks.count { !it.done && !it.archived && isOverdue(it.due) }
                if (mood == "worried" && overdue > 0) pool[0] = tn("emberOverdue", overdue)
                line = pool.random()
                scope.launch {
                    delay(180)
                    squash = false
                    delay(3000)
                    line = ""
                }
            },
        ) {
            drawEmber(mood, blink, tok)
            // a short burst when you poke Ember; nothing draws the rest of the time
            val p = spark.value
            if (p < 1f) for (i in 0 until 7) {
                val a = i / 7f * 2f * Math.PI.toFloat() - Math.PI.toFloat() / 2
                val r = this.size.width * 0.55f * p
                drawCircle(tok.accent2, this.size.width * 0.025f * (1 - 0.7f * p), Offset(this.size.width / 2 + kotlin.math.cos(a) * r, this.size.height * 0.55f + kotlin.math.sin(a) * r - this.size.height * 0.1f * p), 1 - p)
            }
        }
    }
}

private fun DrawScope.drawEmber(mood: String, blink: Boolean, tok: Tok) {
    val k = size.minDimension / 24f
    drawPath(flamePath(size), Brush.linearGradient(listOf(tok.accent2, tok.deep), Offset.Zero, Offset(size.width, size.height)))
    fun oval(cx: Float, cy: Float, rx: Float, ry: Float, c: Color) = drawOval(c, Offset((cx - rx) * k, (cy - ry) * k), Size(rx * 2 * k, ry * 2 * k))
    oval(11f, 17.2f, 3.4f, 2.6f, Color.White.copy(alpha = if (mood == "celebrate") 0.32f else 0.14f))
    val eye = Color(0xFF1D1612)
    val closed = mood == "proud" || mood == "sleepy" || blink
    val shift = if (mood == "worried") 0.4f else 0f
    if (closed) {
        for (x in listOf(7.6f, 11.2f)) {
            val p = Path().apply {
                moveTo(x * k, 15.3f * k)
                quadraticTo((x + 1.1f) * k, 16.3f * k, (x + 2.2f) * k, 15.3f * k)
            }
            drawPath(p, eye, style = Stroke(0.55f * k, cap = StrokeCap.Round))
        }
    } else {
        val ry = if (mood == "focus") 0.45f else 1.1f
        oval(8.7f + shift, 15.6f, 1f, ry, eye)
        oval(12.3f + shift, 15.6f, 1f, ry, eye)
        if (mood != "focus") {
            oval(9f + shift, 15.2f, 0.28f, 0.28f, Color.White.copy(alpha = 0.85f))
            oval(12.6f + shift, 15.2f, 0.28f, 0.28f, Color.White.copy(alpha = 0.85f))
        }
    }
    if (mood == "proud" || mood == "celebrate") {
        oval(7.4f, 17.3f, 0.9f, 0.5f, Color(0x8CFF8A7A))
        oval(13.6f, 17.3f, 0.9f, 0.5f, Color(0x8CFF8A7A))
    }
}

/** Add without leaving ambient. With no date typed it defaults to today; stays open after
 *  Done so several tasks can go in back to back. */
@Composable
private fun AmbientQuickAdd(close: () -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    var title by remember { mutableStateOf("") }
    var note by remember { mutableStateOf<String?>(null) }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val parsed = store.parse(title)
    fun submit() {
        val st = store.state
        val p = store.parse(title)
        val clean = p.title.trim()
        if (clean.isEmpty()) return
        val due = p.due ?: todayStr()
        val time = p.time ?: st.settings["defaultTime"]?.string?.takeIf { it.isNotEmpty() }
        val prio = p.priority ?: st.settings["defaultPriority"]?.string
        if (p.newFolder == null && p.projectId == null && st.projects.isEmpty()) return
        store.dispatch { it.addTask(clean, p.projectId ?: st.projects.firstOrNull()?.id, due, time, prio, p.newFolder) }
        store.sound.add()
        title = ""
        // say where it went — a future-dated task won't appear on this board
        note = if (isToday(due) || isOverdue(due)) t("ambAddedTodo") else t("ambAddedFor", "date" to fmtDue(due))
    }
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).imePadding().padding(16.dp), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 540.dp).fillMaxWidth().card(tok, RoundedCornerShape(15.dp), tok.raise).tap {}.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KIcon("Plus", 14.dp, tok.accent)
                Input(title, { title = it }, t("ambQuickAddPh"), tok.ui(15.5f), Modifier.weight(1f).focusRequester(focus), limit = 140, onDone = { submit() })
                if (title.isBlank()) IconBtn("X", t("close"), 13.dp, onClick = close) else MiniButton("Add", primary = true, onClick = ::submit)
            }
            if (parsed.detected) ParsePills(parsed, label = false)
            else if (note != null) T("✓ $note · ${t("ambEnterEsc")}", tok.ui(12.5f, c = tok.text3))
            else T(t("ambHint"), tok.ui(12.5f, c = tok.text3))
        }
    }
}

@Composable
private fun AmbientEditor(cfg: Item, modifier: Modifier, close: () -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    fun set(k: String, v: J) = store.dispatch { it.setAmbient(itemOf(k to v)) }
    @Composable
    fun section(title: String, c: @Composable ColumnScope.() -> Unit) {
        Column(verticalArrangement = Arrangement.spacedBy(11.dp)) {
            T(title.uppercase(), tok.mono(11f, true))
            c()
        }
    }
    @Composable
    fun seg(label: String, key: String, opts: List<Pair<String, String>>) {
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            T(t(label), tok.ui(13f, c = tok.text2))
            Seg(cfg.str(key), opts.map { it.first to t(it.second) }) { set(key, J.Str(it)) }
        }
    }
    @Composable
    fun toggle(label: String, key: String) = SetRow(t(label)) { KSwitch(cfg.flag(key)) { set(key, it.j()) } }
    @Composable
    fun slider(label: String, key: String, lo: Float, hi: Float, unit: String = "px") {
        val v = cfg.num(key).toFloat()
        Column {
            Row {
                T(t(label), tok.ui(13f, c = tok.text2), Modifier.weight(1f))
                T("${v.toInt()}$unit", tok.mono(12f))
            }
            KSlider(v, lo..hi) { set(key, Math.round(it).toDouble().j()) }
        }
    }
    @Composable
    fun hour(key: String) {
        Menu((0 until 24).map { it to "%02d:00".format(java.util.Locale.ROOT, it) }, { set(key, it.j()) }) { ChipText("%02d:00".format(java.util.Locale.ROOT, cfg.int(key))) }
    }
    Column(modifier.fillMaxHeight().background(tok.raise).tap {}.windowInsetsPadding(WindowInsets.systemBars)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                T(t("ame_ambient_mode"), tok.mono(11f))
                T(t("ame_customize"), tok.display(25f))
            }
            IconBtn("X", t("ame_close_customization"), onClick = close)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            section(t("ame_look")) {
                seg("ame_theme", "theme", listOf("app" to "ame_match_app", "light" to "ame_light", "dark" to "ame_dark"))
                slider("ame_background_glow", "glow", 0f, 200f, "%")
                slider("ame_card_corners", "radius", 0f, 40f)
            }
            section(t("ame_clock")) {
                slider("ame_size", "clockSize", 160f, 900f)
                seg("ame_dial", "clockFace", listOf("minimal" to "ame_minimal", "classic" to "ame_classic", "numerals" to "ame_numerals"))
                seg("ame_second_hand", "seconds", listOf("sweep" to "ame_sweep", "tick" to "ame_tick", "off" to "ame_off"))
                toggle("ame_date", "showDate")
                toggle("ame_digital_time", "showDigital")
            }
            section(t("ame_layout")) {
                seg("ame_clock_side", "side", listOf("left" to "ame_left", "right" to "ame_right"))
                seg("ame_columns", "columns", listOf("both" to "ame_todo_done", "todo" to "ame_todo_only"))
                slider("ame_edge_padding", "padding", 0f, 200f)
                slider("ame_clock_tasks_gap", "gap", 0f, 300f)
                slider("ame_task_text", "rowSize", 12f, 48f)
                slider("ame_max_rows", "maxRows", 3f, 25f, "")
                toggle("ame_quick_add_n", "quickAdd")
                toggle("ame_greeting", "showGreeting")
                toggle("ame_progress_bar", "showProgress")
            }
            section(t("ame_widgets")) {
                val w = listOf("none" to "widget_none", "streak" to "widget_streak", "progress" to "widget_progress", "focus" to "widget_focus")
                seg("ame_slot_1", "widget1", w)
                seg("ame_slot_2", "widget2", w)
                Hint(t("ame_a_widget_with_nothing_to_show_no_focus_running_no_streak_yet_stays_hidden"))
            }
            section(t("ame_ember")) {
                toggle("ame_show_ember", "showEmber")
                slider("ame_size", "emberSize", 48f, 320f)
                seg("ame_corner", "emberCorner", listOf("left" to "ame_bottom_left", "right" to "ame_bottom_right"))
            }
            section(t("ame_night")) {
                seg("ame_night_mode", "night", listOf("off" to "ame_off", "dim" to "ame_dim", "dark" to "ame_dim_dark"))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    T(t("ame_from_to"), tok.ui(13f, c = tok.text2), Modifier.weight(1f))
                    hour("nightStart")
                    T("→", tok.ui(13f, c = tok.text3))
                    hour("nightEnd")
                }
                slider("ame_dim_brightness", "nightLevel", 15f, 100f, "%")
            }
            section(t("ame_screen_care")) {
                slider("ame_burn_in_drift", "drift", 0f, 40f)
                Hint(t("ame_nudges_everything_by_up_to_this_many_pixels_every_3_minutes_0_turns_it_off"))
            }
        }
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            MiniButton(t("ame_reset_to_defaults")) { store.dispatch { it.setSettings(itemOf("ambient" to J.Obj(emptyMap()))) } }
            Spacer(Modifier.weight(1f))
            T(t("ame_saved_automatically"), tok.ui(12f, c = tok.text3))
        }
    }
}
