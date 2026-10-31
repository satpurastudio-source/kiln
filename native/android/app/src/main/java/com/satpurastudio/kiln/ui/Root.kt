@file:OptIn(ExperimentalLayoutApi::class)

package com.satpurastudio.kiln.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.satpurastudio.kiln.Store
import com.satpurastudio.kiln.Toast
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.delay

enum class SheetKind { Settings, Help, Feedback, WhatsNew }
class ProjectEdit(val project: Project?)

@Composable
fun KilnRoot(store: Store, setBars: (Boolean) -> Unit) {
    val s = store.state
    val tok = remember(s.theme, s.settings["accent"], s.settings["customAccent"], s.settings["textScale"]) { Tok.of(s) }
    val language = s.language
    LaunchedEffect(tok.dark) { setBars(tok.dark) }
    var ambient by remember { mutableStateOf(false) }
    var ambientCustomize by remember { mutableStateOf(false) }
    CompositionLocalProvider(
        LocalTok provides tok,
        LocalStore provides store,
        LocalLayoutDirection provides if (language == "ur") LayoutDirection.Rtl else LayoutDirection.Ltr,
    ) {
        // words are looked up while composing, so a switch repaints everything
        key(language) {
            Box(Modifier.fillMaxSize().background(tok.bg)) {
                Backdrop()
                when {
                    !s.onboarded -> OnboardingScreen()
                    s.profile == null -> LoginScreen()
                    ambient -> AmbientScreen(ambientCustomize) { ambient = false }
                    else -> MainScreen { c ->
                        ambientCustomize = c
                        ambient = true
                    }
                }
                ConfettiLayer(store.confetti)
                ToastStack()
            }
        }
    }
}

@Composable
private fun MainScreen(openAmbient: (Boolean) -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    var drawer by remember { mutableStateOf(false) }
    var palette by remember { mutableStateOf(false) }
    var sheet by remember { mutableStateOf<SheetKind?>(null) }
    var projectEdit by remember { mutableStateOf<ProjectEdit?>(null) }
    var query by remember { mutableStateOf("") }
    var pendingQuery by remember { mutableStateOf("") }
    val viewKey = store.state.view.key

    LaunchedEffect(viewKey) {
        query = pendingQuery
        pendingQuery = ""
    }
    LaunchedEffect(Unit) {
        store.askRemindersOnFirstLaunch()
        delay(1200)
        if (shouldShowWhatsNew(store) && sheet == null) sheet = SheetKind.WhatsNew
    }

    // back: close what's on top, else toggle into the drawer, else leave the app
    BackHandler(enabled = palette || projectEdit != null || sheet != null || store.focusOpen || !drawer) {
        when {
            palette -> palette = false
            projectEdit != null -> projectEdit = null
            sheet != null -> sheet = null
            store.focusOpen -> store.focusOpen = false
            else -> drawer = true
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 860.dp
        Row(Modifier.fillMaxSize()) {
            if (wide) {
                SidebarView(
                    Modifier.width(288.dp).fillMaxHeight().windowInsetsPadding(WindowInsets.systemBars.only(WindowInsetsSides.Vertical + WindowInsetsSides.Start)),
                    onNewFolder = { projectEdit = ProjectEdit(null) }, onEdit = { projectEdit = ProjectEdit(it) }, onSettings = { sheet = SheetKind.Settings }, close = {},
                )
                Box(Modifier.width(1.dp).fillMaxHeight().background(tok.border))
            }
            Content(wide, query, { query = it }, { drawer = true }, { palette = true })
        }
        if (!wide) {
            AnimatedVisibility(drawer, enter = fadeIn(), exit = fadeOut()) {
                Box(Modifier.fillMaxSize().background(tok.scrim).tap { drawer = false })
            }
            AnimatedVisibility(drawer, enter = slideInHorizontally { -it }, exit = slideOutHorizontally { -it }) {
                SidebarView(
                    Modifier.width(288.dp).fillMaxHeight().background(tok.bg).windowInsetsPadding(WindowInsets.systemBars).pointerInput(Unit) {
                        var dx = 0f
                        detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = { if (dx < -80f) drawer = false }) { _, d -> dx += d }
                    },
                    onNewFolder = { drawer = false; projectEdit = ProjectEdit(null) },
                    onEdit = { drawer = false; projectEdit = ProjectEdit(it) },
                    onSettings = { drawer = false; sheet = SheetKind.Settings },
                    close = { drawer = false },
                )
            }
            if (!drawer) {
                Box(Modifier.width(20.dp).fillMaxHeight().pointerInput(Unit) {
                    var dx = 0f
                    detectHorizontalDragGestures(onDragStart = { dx = 0f }, onDragEnd = {
                        if (dx > 60f) {
                            Tips.markSeen(store, "swipe-nav")
                            drawer = true
                        }
                    }) { _, d -> dx += d }
                })
            }
        }
        FocusLayer()
        MiniCalendarLauncher()
        CompleteZone()
        if (palette) {
            PaletteView(
                close = { palette = false }, openSheet = { sheet = it }, newFolder = { projectEdit = ProjectEdit(null) }, openAmbient = { openAmbient(false) },
                openTask = { task ->
                    val v = Screen("project", task.projectId)
                    if (v.key == store.state.view.key) query = task.title
                    else {
                        pendingQuery = task.title
                        store.dispatch { it.copy(view = v) }
                    }
                },
            )
        }
        sheet?.let { k ->
            when (k) {
                SheetKind.Settings -> SettingsSheet({ sheet = null }, { sheet = it }, { c ->
                    sheet = null
                    openAmbient(c)
                })
                SheetKind.Help -> HelpSheet { sheet = null }
                SheetKind.Feedback -> FeedbackSheet { sheet = null }
                SheetKind.WhatsNew -> WhatsNewSheet { sheet = null }
            }
        }
        projectEdit?.let { ProjectEditorSheet(it.project) { projectEdit = null } }
    }
}

@Composable
private fun RowScope.Content(wide: Boolean, query: String, setQuery: (String) -> Unit, openDrawer: () -> Unit, openPalette: () -> Unit) {
    val store = LocalStore.current
    val v = store.state.view
    val pad = if (wide) 34.dp else 14.dp
    Column(
        Modifier.weight(1f).fillMaxHeight().windowInsetsPadding(WindowInsets.systemBars.only(WindowInsetsSides.Top + WindowInsetsSides.End)).imePadding(),
    ) {
        Row(Modifier.padding(start = pad, end = pad, top = if (wide) 26.dp else 8.dp), verticalAlignment = Alignment.Top) {
            if (!wide) IconBtn("Menu", t("openMenu"), onClick = openDrawer)
            HeaderView(query, setQuery, openPalette, Modifier.weight(1f))
        }
        // pulling past the top on a phone opens the search
        var pulled by remember { mutableFloatStateOf(0f) }
        val pull = remember {
            object : NestedScrollConnection {
                override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                    if (available.y > 0) {
                        pulled += available.y
                        if (pulled > 260f) {
                            pulled = 0f
                            Tips.markSeen(store, "pull-search")
                            openPalette()
                        }
                    } else if (consumed.y != 0f) pulled = 0f
                    return Offset.Zero
                }

                override suspend fun onPreFling(available: androidx.compose.ui.unit.Velocity): androidx.compose.ui.unit.Velocity {
                    pulled = 0f
                    return androidx.compose.ui.unit.Velocity.Zero
                }
            }
        }
        val content = Modifier.weight(1f).fillMaxWidth().nestedScroll(pull)
        when (v.type) {
            "calendar" -> ScrollPage(content, pad) { CalendarView() }
            "insights" -> ScrollPage(content, pad) { InsightsView() }
            "archive" -> ScrollPage(content, pad) { ArchiveView() }
            "trash" -> ScrollPage(content, pad) { TrashView() }
            else -> TaskListView(query, wide, content, pad)
        }
    }
}

@Composable
private fun ScrollPage(modifier: Modifier, pad: androidx.compose.ui.unit.Dp, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.verticalScroll(rememberScrollState()).padding(start = pad, end = pad, bottom = 110.dp).widthIn(max = 820.dp), content = content)
}

@Composable
private fun ToastStack() {
    val store = LocalStore.current
    val tok = LocalTok.current
    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).imePadding().padding(start = 16.dp, end = 16.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.Bottom),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        store.toasts.forEach { x -> key(x.id) { ToastRow(x, tok) } }
    }
}

@Composable
private fun ToastRow(x: Toast, tok: Tok) {
    val store = LocalStore.current
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    AnimatedVisibility(shown, enter = fadeIn() + slideInVertically { it / 2 }) {
        Row(
            Modifier.background(tok.raise, CircleShape).border(1.dp, tok.border, CircleShape).padding(horizontal = 15.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            T(x.icon, tok.ui(14f))
            T(x.message, tok.ui(13.25f, FontWeight.Medium), Modifier.weight(1f, fill = false), maxLines = 2)
            if (x.actionLabel != null) {
                T(x.actionLabel, tok.ui(13.25f, FontWeight.SemiBold, tok.accent), Modifier.tap {
                    x.action?.invoke()
                    store.toasts.removeAll { it.id == x.id }
                })
            }
        }
    }
}

/** One-time coaching hints. Dismissed tips are remembered and never nag again. */
object Tips {
    private fun read(store: Store) = J.parse(store.prefs.string("kiln-tips") ?: "[]")?.array.orEmpty().mapNotNull { it.string }
    fun seen(store: Store, id: String) = id in read(store)
    fun markSeen(store: Store, id: String) {
        val r = read(store)
        if (id !in r) store.prefs.set("kiln-tips", J.Arr((r + id).map { J.Str(it) }).stable)
    }
}

@Composable
fun Tip(id: String, text: String) {
    val store = LocalStore.current
    val tok = LocalTok.current
    var gone by remember { mutableStateOf(Tips.seen(store, id)) }
    if (gone) return
    Row(
        Modifier.padding(top = 12.dp).fillMaxWidth().background(tok.accent.copy(alpha = 0.07f), R12).border(1.dp, tok.accent.copy(alpha = 0.2f), R12).padding(start = 12.dp, top = 12.dp, bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        KIcon("Sparkle", 13.dp, tok.accent, Modifier.padding(top = 2.dp))
        T(text, tok.ui(13f, c = tok.text2), Modifier.weight(1f))
        IconBtn("X", t("close"), 12.dp, tok.text3) {
            Tips.markSeen(store, id)
            gone = true
        }
    }
}

@Composable
fun SidebarView(modifier: Modifier, onNewFolder: () -> Unit, onEdit: (Project) -> Unit, onSettings: () -> Unit, close: () -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val active = s.tasks.filter { !it.done && !it.archived }
    val tp = s.todayProgress
    Column(modifier.background(tok.panel).padding(start = 16.dp, end = 14.dp, top = 20.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(Modifier.padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            BrandMark(34.dp)
            Column {
                Row {
                    T("kiln", tok.ui(16f, FontWeight.Medium))
                    T(".", tok.ui(16f, FontWeight.Medium, tok.accent))
                }
                T(t("brandTag"), tok.mono(10.5f))
            }
        }
        @Composable
        fun nav(type: String, icon: String, label: String, count: Int = 0) {
            val on = s.view.type == type
            Row(
                Modifier.fillMaxWidth().heightIn(min = 40.dp).background(if (on) tok.accent.copy(alpha = 0.12f) else Color.Transparent, R9).tap {
                    store.dispatch { it.copy(view = Screen(type)) }
                    close()
                }.padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(11.dp),
            ) {
                KIcon(icon, 15.dp, if (on) tok.accent else tok.text2)
                T(label, tok.ui(13.5f, FontWeight.Medium, if (on) tok.text else tok.text2), Modifier.weight(1f), maxLines = 1)
                if (count > 0) T(fmtNum(count), tok.mono(11.5f))
            }
        }
        nav("today", "Sun", t("nav_today"), active.count { isToday(it.due) || isOverdue(it.due) })
        nav("upcoming", "Clock", t("nav_upcoming"), active.count { it.due != null })
        nav("calendar", "Calendar", t("nav_calendar"))
        nav("all", "Layers", t("nav_all"), active.size)
        nav("insights", "Chart", t("nav_insights"))
        Row(Modifier.padding(start = 12.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            T(t("folders").uppercase(), tok.mono(11.5f, true), Modifier.weight(1f))
            IconBtn("Plus", t("newFolder"), 13.dp, tok.text3, onNewFolder)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            s.projects.forEach { p ->
                key(p.id) {
                    val on = s.view.type == "project" && s.view.projectId == p.id
                    val prog = s.projectProgress(p.id)
                    Row(Modifier.fillMaxWidth().background(if (on) tok.accent.copy(alpha = 0.12f) else Color.Transparent, R9), verticalAlignment = Alignment.CenterVertically) {
                        Row(
                            Modifier.weight(1f).heightIn(min = 40.dp).tap {
                                store.dispatch { it.copy(view = Screen("project", p.id)) }
                                close()
                            }.padding(start = 12.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(11.dp),
                        ) {
                            Box(Modifier.width(15.dp), contentAlignment = Alignment.Center) { Box(Modifier.size(9.dp).background(color(p.color), CircleShape)) }
                            T(p.name, tok.ui(13.5f, FontWeight.Medium, if (on) tok.text else tok.text2), Modifier.weight(1f), maxLines = 1)
                            if (prog.total > 0) ProgressRing(17.dp, 2.4.dp, prog.pct.toFloat())
                        }
                        IconBtn("Pencil", t("editFolder"), 12.dp, tok.text3) { onEdit(p) }
                    }
                }
            }
        }
        nav("archive", "Archive", t("nav_archive"), s.tasks.count { it.archived })
        nav("trash", "Trash", t("nav_trash"), s.trash.size)
        if (s.isCloud && (store.syncStatus == SyncStatus.Offline || store.syncStatus == SyncStatus.Error)) {
            Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(Color(0xFFD98E32), CircleShape))
                T(if (store.syncStatus == SyncStatus.Offline) t("offlineSaved") else t("notSyncedRetrying"), tok.ui(12f, c = tok.text2))
            }
        }
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ProgressRing(34.dp, 3.4.dp, tp.pct.toFloat())
            Column(Modifier.weight(1f)) {
                T("${fmtNum(tp.done)} ${t("doneToday")}", tok.ui(11.5f, c = tok.text2), maxLines = 1)
                T("${fmtNum(tp.active)} ${t("toGo")}", tok.ui(11.5f, c = tok.text2), maxLines = 1)
            }
            IconBtn(if (s.sound) "Bell" else "BellOff", if (s.sound) t("muteSounds") else t("unmuteSounds"), 15.dp) { store.dispatch { it.copy(sound = !it.sound) } }
            IconBtn(if (s.theme == "dark") "Moon" else "Sun", t("toggleTheme"), 15.dp) { store.dispatch { it.copy(theme = if (it.theme == "dark") "light" else "dark") } }
            IconBtn("Settings", t("settings"), 15.dp, onClick = onSettings)
        }
    }
}

@Composable
fun CompleteZone() {
    val store = LocalStore.current
    val tok = LocalTok.current
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).padding(bottom = 34.dp), contentAlignment = Alignment.BottomCenter) {
        AnimatedVisibility(store.dragging, enter = slideInVertically { it * 2 }, exit = slideOutVertically { it * 2 }) {
            val hot = store.dragHot
            Row(
                Modifier.background(if (hot) tok.accent else tok.raise, CircleShape).border(1.dp, tok.accent.copy(alpha = 0.5f), CircleShape).padding(horizontal = 22.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FlameMark(20.dp, if (hot) Color.White else tok.accent, 1.6f)
                T(if (hot) t("releaseToComplete") else t("dropToComplete"), tok.ui(14f, FontWeight.SemiBold, if (hot) Color.White else tok.text))
            }
        }
    }
}

private class Bit(val x: Float, val vx: Float, val vy: Float, val spin: Float, val size: Float, val color: Int)

/** Only exists while it's flying, so it costs nothing the rest of the time. */
@Composable
fun ConfettiLayer(trigger: Int) {
    val tok = LocalTok.current
    if (trigger == 0) return
    var time by remember(trigger) { mutableFloatStateOf(0f) }
    var running by remember(trigger) { mutableStateOf(true) }
    val bits = remember(trigger) {
        List(90) { i ->
            val side = i % 3
            val r = kotlin.random.Random(i + trigger * 1000)
            fun range(a: Float, b: Float) = a + r.nextFloat() * (b - a)
            Bit(
                if (side == 0) 0.5f else if (side == 1) 0.05f else 0.95f,
                if (side == 0) range(-900f, 900f) else if (side == 1) range(180f, 1250f) else range(-1250f, -180f),
                range(-2300f, -900f), range(-9f, 9f), range(16f, 30f), i,
            )
        }
    }
    val colors = remember(tok.accent) { listOf(tok.accent, Color(0xFFD85A30), Color(0xFFD9A441), Color(0xFFF4EFE4)) }
    LaunchedEffect(trigger) {
        val start = androidx.compose.runtime.withFrameNanos { it }
        while (time < 2.4f) {
            androidx.compose.runtime.withFrameNanos { time = (it - start) / 1e9f }
        }
        running = false
    }
    if (!running) return
    Canvas(Modifier.fillMaxSize()) {
        val alpha = (1f - time / 2.4f).coerceIn(0f, 1f)
        for (b in bits) {
            val x = b.x * size.width + b.vx * time
            val y = size.height * 0.68f + b.vy * time + 1560f * time * time
            drawCircle(colors[b.color % colors.size], b.size / 2, Offset(x, y), alpha)
        }
    }
}
