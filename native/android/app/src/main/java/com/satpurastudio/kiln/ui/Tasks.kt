@file:OptIn(ExperimentalLayoutApi::class, ExperimentalFoundationApi::class)

package com.satpurastudio.kiln.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.zIndex
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun HeaderView(query: String, setQuery: (String) -> Unit, openPalette: () -> Unit, modifier: Modifier = Modifier) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val v = s.view
    val project = if (v.type == "project") s.projects.firstOrNull { it.id == v.projectId } else null
    val activeCount = s.active().size
    val prog = project?.let { s.projectProgress(it.id) }
    val today = s.todayProgress
    var showSearch by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                val title = when (v.type) {
                    "today" -> "${greeting()}, ${s.profile?.get("name")?.string?.trim()?.split(Regex("\\s+"))?.firstOrNull()?.takeIf { it.isNotEmpty() } ?: t("friendShort")}"
                    "upcoming", "calendar", "insights", "archive", "trash", "all" -> t("nav_${v.type}")
                    else -> project?.name ?: t("folder")
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    if (project != null) T(iconGlyph(project.icon), tok.ui(26f, c = color(project.color)))
                    T("$title.", tok.display(40f), maxLines = 2)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    if (v.type == "today") Box(Modifier.size(6.dp).background(tok.accent, CircleShape))
                    val sub = when (v.type) {
                        "today" -> "${fmtLongDate()} — ${if (activeCount == 0) t("allClearLower") else tn("tasksToGo", activeCount)}"
                        "project" -> prog?.let { t("doneOfTotal", "done" to fmtNum(it.done), "total" to fmtNum(it.total)) } ?: ""
                        "calendar" -> tn("scheduledTasks", activeCount)
                        "insights" -> t("subInsights")
                        "archive" -> t("subArchive")
                        "trash" -> t("subTrash")
                        else -> tn("openTasks", activeCount)
                    }
                    T(sub, tok.ui(13.5f, c = tok.text2), maxLines = 2)
                }
            }
            IconBtn("Search", t("searchPh")) {
                showSearch = !showSearch
                if (!showSearch) setQuery("")
            }
            IconBtn("Command", t("commandPaletteTitle"), onClick = openPalette)
        }
        if (showSearch || query.isNotEmpty()) {
            Box(Modifier.fillMaxWidth().height(40.dp).card(tok, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                Input(query, setQuery, t("searchPh"), tok.ui(14f), Modifier.fillMaxWidth().focusRequester(focus))
            }
            LaunchedEffect(showSearch) { if (showSearch) focus.requestFocus() }
        }
        val bar = if (prog != null && prog.total > 0) Triple(prog.pct, prog.done, prog.total) else if (v.type == "today" && today.total > 0) Triple(today.pct, today.done, today.total) else null
        if (bar != null) GoalBar(bar.first, bar.second, bar.third)
    }
}

@Composable
private fun GoalBar(pct: Int, done: Int, total: Int) {
    val tok = LocalTok.current
    val milestone = if (pct >= 100) t("msCleared") else if (pct >= 80) t("msClose") else if (pct >= 50) t("msHalfway") else null
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.fillMaxWidth().height(5.dp).background(tok.border, CircleShape)) {
            Box(Modifier.fillMaxWidth(pct / 100f).fillMaxHeight().background(Brush.horizontalGradient(listOf(tok.accent, tok.accent2)), CircleShape))
        }
        Row {
            if (milestone != null) T(milestone, tok.ui(12f, FontWeight.Medium, tok.accent))
            Spacer(Modifier.weight(1f))
            T("$done/$total · $pct%", tok.mono(11.5f))
        }
    }
}

@Composable
private fun QuickAddView() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val viewKey = s.view.key
    fun defaultProject() = if (s.view.type == "project") s.view.projectId else s.projects.firstOrNull()?.id
    var title by remember { mutableStateOf("") }
    var due by remember(viewKey) { mutableStateOf(store.newTaskDue(s.view)) }
    var time by remember(viewKey) { mutableStateOf(s.settings["defaultTime"]?.string ?: "") }
    var priority by remember(viewKey) { mutableStateOf(s.settings["defaultPriority"]?.string ?: "none") }
    var projectId by remember(viewKey) { mutableStateOf(defaultProject()) }
    var focused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    // the picked folder was deleted (here or on another device) → fall back
    LaunchedEffect(s.projects) { if (s.projects.none { it.id == projectId }) projectId = defaultProject() }
    val parsed = remember(title, s.projects) { store.parse(title) }
    val expanded = focused || title.isNotEmpty()

    fun submit() {
        val st = store.state
        val p = store.parse(title)
        val final = p.title.trim()
        if (final.isEmpty()) return
        val dueValue = p.due ?: due
        val timeValue = p.time ?: time.takeIf { it.isNotEmpty() }
        val prio = p.priority ?: priority
        if (p.newFolder != null) {
            // "#name" for a folder that doesn't exist → create it and file the task
            store.dispatch { it.addTask(final, null, dueValue, timeValue, prio, p.newFolder) }
            store.toast(t("createdFolder", "name" to p.newFolder), "📁")
        } else {
            val pid = p.projectId ?: projectId
            store.dispatch { it.addTask(final, pid, dueValue, timeValue, prio) }
            // the task went somewhere this view doesn't show — say where
            if (!AppState.inView(dueValue, pid ?: "", st.view)) {
                val folder = st.projects.firstOrNull { it.id == pid }?.name ?: t("inbox")
                store.toast(t("addedTo", "folder" to folder, "when" to if (dueValue != null) fmtDue(dueValue) else t("noDateLower")), "✓")
            }
        }
        title = ""
        priority = st.settings["defaultPriority"]?.string ?: "none"
        store.sound.add()
        if (timeValue != null) store.offerReminders()
    }

    Column(
        Modifier.padding(top = 14.dp, bottom = 18.dp).fillMaxWidth().animateContentSize()
            .background(tok.panelStrong, R12).border(1.dp, if (focused) tok.accent.copy(alpha = 0.5f) else tok.border, R12),
    ) {
        Row(Modifier.heightIn(min = 52.dp).padding(start = 14.dp, end = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            KIcon("Plus", 14.dp, tok.accent, Modifier.graphicsLayer { rotationZ = if (expanded) 45f else 0f })
            Input(
                title, { title = it }, t("quickAddPh"), tok.ui(15f),
                Modifier.weight(1f).focusRequester(focus).onFocusChanged { focused = it.isFocused }, limit = 140, onDone = { submit() },
            )
            Box(
                Modifier.size(32.dp).background(tok.accent, CircleShape).clip(CircleShape).tap(label = t("addTask")) {
                    if (title.isBlank()) focus.requestFocus() else submit()
                },
                contentAlignment = Alignment.Center,
            ) { KIcon("Plus", 15.dp, Color.White) }
        }
        if (expanded) {
            Column(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (parsed.detected) ParsePills(parsed)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    val today = todayStr()
                    val tomorrow = addDaysStr(1)
                    Chip(due == today, { due = if (due == today) null else today }) {
                        KIcon("Sun", 12.dp, if (due == today) tok.accent else tok.text2)
                        ChipText(t("today"), due == today)
                    }
                    Chip(due == tomorrow, { due = if (due == tomorrow) null else tomorrow }) { ChipText("→ ${t("tomorrow")}", due == tomorrow) }
                    DueField(due) { due = it }
                    TimeField(time) { time = it }
                    PRIORITIES.filter { it.first != "none" }.forEach { (id, c) ->
                        Chip(priority == id, { priority = if (priority == id) "none" else id }) {
                            KIcon("Flag", 11.dp, color(c))
                            ChipText(t("prio_$id"), priority == id)
                        }
                    }
                    FolderMenu(projectId ?: s.projects.firstOrNull()?.id) { projectId = it }
                }
            }
        }
    }
}

@Composable
fun ParsePills(parsed: Parsed, label: Boolean = true) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val project = parsed.projectId?.let { id -> store.state.projects.firstOrNull { it.id == id } }
    @Composable
    fun pill(icon: String?, text: String, dot: Color? = null) {
        Row(
            Modifier.background(tok.accent.copy(alpha = 0.1f), CircleShape).padding(horizontal = 9.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            if (icon != null) KIcon(icon, 11.dp, tok.accent)
            if (dot != null) Box(Modifier.size(7.dp).background(dot, CircleShape))
            T(text, tok.ui(12f, FontWeight.Medium, tok.accent), maxLines = 1)
        }
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (label) T("reading:", tok.mono(11f), Modifier.padding(vertical = 4.dp))
        parsed.due?.let { pill("Calendar", fmtDue(it)) }
        parsed.time?.let { pill("Clock", fmtTime(it)) }
        parsed.priority?.let { pill("Flag", t("prio_$it")) }
        project?.let { pill(null, it.name, color(it.color)) }
        parsed.newFolder?.let { pill("Plus", "${t("newFolder")} · $it") }
    }
}

@Composable
fun DueField(due: String?, set: (String?) -> Unit) {
    val tok = LocalTok.current
    val context = LocalContext.current
    fun pick() {
        val d = due?.let(::parseDateStr) ?: D.now
        DatePickerDialog(context, { _, y, m, day -> set(toDateStr(D.make(y, m, day))) }, d.year, d.month0, d.day).show()
    }
    Chip(due != null, ::pick) {
        KIcon("Calendar", 12.dp, if (due != null) tok.accent else tok.text2)
        ChipText(if (due != null) fmtDue(due) else t("pickDate"), due != null)
        if (due != null) KIcon("X", 9.dp, tok.text3, Modifier.tap(label = t("clear")) { set(null) })
    }
}

@Composable
fun TimeField(time: String, set: (String) -> Unit) {
    val tok = LocalTok.current
    val context = LocalContext.current
    fun pick() {
        val p = time.split(":").map { it.toIntOrNull() ?: 0 }
        TimePickerDialog(context, { _, h, m -> set("%02d:%02d".format(java.util.Locale.ROOT, h, m)) }, p.getOrElse(0) { 9 }, p.getOrElse(1) { 0 }, false).show()
    }
    val on = time.isNotEmpty()
    Chip(on, ::pick) {
        KIcon("Clock", 12.dp, if (on) tok.accent else tok.text2)
        ChipText(if (on) fmtTime(time) else t("setTime"), on)
        if (on) KIcon("X", 9.dp, tok.text3, Modifier.tap(label = t("clear")) { set("") })
    }
}

@Composable
fun <V> Menu(options: List<Pair<V, String>>, pick: (V) -> Unit, label: @Composable RowScope.() -> Unit) {
    val tok = LocalTok.current
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.heightIn(min = 32.dp).border(1.dp, tok.border, CircleShape).clip(CircleShape).tap { open = true }.padding(horizontal = 11.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), content = label,
        )
        DropdownMenu(open, { open = false }, containerColor = tok.raise) {
            options.forEach { (v, text) ->
                DropdownMenuItem({ T(text, tok.ui(14f)) }, {
                    open = false
                    pick(v)
                })
            }
        }
    }
}

@Composable
fun FolderMenu(projectId: String?, pick: (String) -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val list = store.state.projects
    val p = list.firstOrNull { it.id == projectId }
    Menu(list.map { it.id to "${iconGlyph(it.icon)} ${it.name}" }, pick) {
        Box(Modifier.size(8.dp).background(color(p?.color ?: tok.accentHex), CircleShape))
        ChipText(p?.name ?: t("folder"))
    }
}

private fun <T> stableBy(list: List<T>, key: (T) -> Int) = list.sortedBy(key)

/** The main list. One lazy column for everything, so a long list only ever lays out what's on screen. */
@Composable
fun TaskListView(query: String, wide: Boolean, modifier: Modifier, pad: androidx.compose.ui.unit.Dp) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val s = store.state
    val v = s.view
    val active = remember(s.tasks, v, query, store.day) { s.active(query) }
    val completed = remember(s.tasks, v, query, store.day) { s.completed(query) }
    val reorderable = (v.type == "all" || v.type == "project") && query.isEmpty()
    val showProject = v.type != "project"
    var showCompleted by remember(v.key) { mutableStateOf(false) }
    val rank = { x: KTask -> priorityRank[x.priority] ?: 3 }
    val reorder = rememberReorder(active.map { it.id })

    LazyColumn(modifier, contentPadding = PaddingValues(start = pad, end = pad, bottom = 110.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item("tips") {
            if (!wide) {
                if (!Tips.seen(store, "swipe-nav")) Tip("swipe-nav", t("tipSwipe"))
                else if (!Tips.seen(store, "pull-search")) Tip("pull-search", t("tipPull"))
            }
        }
        item("add") { QuickAddView() }
        fun LazyListScope.group(label: String, list: List<KTask>, overdue: Boolean) {
            if (list.isEmpty()) return
            item("g-$label") {
                Row(Modifier.padding(start = 4.dp, top = 10.dp, bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    T(label, tok.ui(13.25f, FontWeight.SemiBold, if (overdue) tok.danger else tok.text2))
                    T(fmtNum(list.size), tok.mono(11.5f))
                }
            }
            items(list, key = { it.id }) { x -> TaskRow(x, showProject, Modifier.animateItem()) }
        }
        when {
            active.isEmpty() -> item("empty") { EmptyState(if (query.isEmpty()) v.type else "search") }
            v.type == "today" -> {
                group(t("overdue"), stableBy(active.filter { isOverdue(it.due) }, rank), true)
                group(t("today"), stableBy(active.filter { !isOverdue(it.due) }, rank), false)
            }
            v.type == "upcoming" -> s.groupUpcoming(active).forEach { g -> group(g.label, g.tasks, g.id == "overdue") }
            else -> items(active, key = { it.id }) { x ->
                TaskRow(x, showProject, if (reorder.dragging == x.id) reorder.rowModifier(x.id) else reorder.rowModifier(x.id).animateItem(), if (reorderable) reorder else null)
            }
        }
        if (completed.isNotEmpty()) {
            item("completed") {
                Row(Modifier.padding(start = 4.dp, end = 4.dp, top = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(Modifier.weight(1f).heightIn(min = 36.dp).tap { showCompleted = !showCompleted }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        KIcon("Chevron", 12.dp, tok.text2, Modifier.graphicsLayer { rotationZ = if (showCompleted) 90f else 0f })
                        T("${if (v.type == "today") t("completedToday") else t("completed")} · ${fmtNum(completed.size)}", tok.ui(13.25f, FontWeight.SemiBold, tok.text2))
                    }
                    T(t("clear"), tok.ui(12.5f, FontWeight.Medium, tok.text3), Modifier.tap {
                        val ids = completed.map { it.id }
                        store.dispatch { it.deleteTasks(ids) }
                        store.toast(t("clearedCompleted", "n" to fmtNum(ids.size)), "🧹", t("undo")) { store.dispatch { it.restoreTasks(ids) } }
                    }.padding(8.dp))
                }
            }
            if (showCompleted) items(completed, key = { it.id }) { x -> TaskRow(x, showProject, Modifier.animateItem()) }
        }
    }
}

/** Lets rows be dragged by their grip. Heights are measured, so rows of any height swap at
 *  the right moment; a drop in the bottom zone completes the task. */
class Reorder(private val store: com.satpurastudio.kiln.Store, private val gapPx: Float, private val zonePx: Float, private val windowHeight: () -> Int, private val buzz: () -> Unit) {
    var ids: List<String> = emptyList()
    var dragging by mutableStateOf<String?>(null)
    var offset by mutableFloatStateOf(0f)
    private val heights = HashMap<String, Int>()
    private var y = 0f

    @Composable
    fun rowModifier(id: String): Modifier = Modifier.onSizeChanged { heights[id] = it.height }.graphicsLayer {
        if (dragging == id) {
            translationY = offset
            scaleX = 1.03f
            scaleY = 1.03f
            shadowElevation = 14f
        }
    }.zIndex(if (dragging == id) 2f else 0f)

    fun start(id: String, rootY: Float) {
        dragging = id
        offset = 0f
        y = rootY
        store.dragging = true
        buzz()
    }

    fun move(id: String, dy: Float) {
        offset += dy
        y += dy
        store.dragHot = y > windowHeight() - zonePx
        val list = ids.toMutableList()
        val i = list.indexOf(id)
        if (i < 0) return
        if (offset > 0 && i + 1 < list.size) {
            val h = (heights[list[i + 1]] ?: 160) + gapPx
            if (offset > h * 0.55f) swap(list, i, i + 1, -h)
        } else if (offset < 0 && i > 0) {
            val h = (heights[list[i - 1]] ?: 160) + gapPx
            if (-offset > h * 0.55f) swap(list, i, i - 1, h)
        }
    }

    private fun swap(list: MutableList<String>, a: Int, b: Int, by: Float) {
        java.util.Collections.swap(list, a, b)
        offset += by
        ids = list
        store.dispatch { it.reorderTasks(list) }
        buzz()
    }

    fun end(task: KTask) {
        val hot = store.dragHot
        dragging = null
        offset = 0f
        store.dragging = false
        store.dragHot = false
        if (hot) {
            store.sound.complete()
            store.completeWithFlourish(task)
        }
    }
}

@Composable
private fun rememberReorder(ids: List<String>): Reorder {
    val store = LocalStore.current
    val haptic = LocalHapticFeedback.current
    val window = LocalWindowInfo.current
    val density = androidx.compose.ui.platform.LocalDensity.current
    val r = remember { with(density) { Reorder(store, 8.dp.toPx(), 130.dp.toPx(), { window.containerSize.height }, { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove) }) } }
    r.ids = ids
    return r
}

@Composable
private fun TaskRow(task: KTask, showProject: Boolean, modifier: Modifier = Modifier, reorder: Reorder? = null) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val haptic = LocalHapticFeedback.current
    val project = store.state.projects.firstOrNull { it.id == task.projectId }
    var open by remember(task.id) { mutableStateOf(false) }
    var checking by remember(task.id) { mutableStateOf(false) }
    val done = task.done || checking
    var rootY by remember { mutableFloatStateOf(0f) }

    fun toggle() {
        if (task.done) {
            store.dispatch { it.toggleTask(task.id) }
            store.sound.pop()
            return
        }
        if (checking) return
        checking = true
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        store.sound.complete()
        // on the store's scope: a tap is never dropped, even if the row goes away mid-animation
        store.scope.launchDelayed(620) {
            if (store.state.tasks.any { it.id == task.id && !it.done }) store.completeWithFlourish(task)
            checking = false
        }
    }

    Column(modifier.fillMaxWidth().alpha(if (done && !open) 0.75f else 1f).card(tok).animateContentSize()) {
        Row(
            Modifier.fillMaxWidth().tap { open = !open }.padding(start = if (reorder != null) 0.dp else 2.dp, end = 0.dp, top = 2.dp, bottom = 2.dp)
                .onGloballyPositioned { rootY = it.positionInRoot().y },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (reorder != null) {
                Box(
                    Modifier.size(28.dp, 44.dp).pointerInput(task.id) {
                        detectDragGestures(
                            onDragStart = { reorder.start(task.id, rootY + it.y) },
                            onDragEnd = { reorder.end(task) },
                            onDragCancel = { reorder.end(task) },
                        ) { change, drag ->
                            change.consume()
                            reorder.move(task.id, drag.y)
                        }
                    },
                    contentAlignment = Alignment.Center,
                ) { KIcon("Grip", 14.dp, tok.text3) }
            }
            CheckCircle(done, color(project?.color ?: tok.accentHex), ::toggle)
            Column(Modifier.weight(1f).padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                T(
                    task.title,
                    tok.ui(15f, FontWeight.Medium, if (done) tok.text3 else tok.text).copy(textDecoration = if (done) TextDecoration.LineThrough else null),
                    maxLines = if (open) Int.MAX_VALUE else 1,
                )
                TaskMeta(task, project, showProject)
            }
            if (!task.done) IconBtn("Play", t("focusOnTask"), 11.dp, tok.text3) { store.startFocus(task.id) }
            IconBtn("X", t("deleteTask"), 11.dp, tok.text3) { store.remove(task) }
        }
        if (open) TaskEditor(task)
    }
}

private fun CoroutineScope.launchDelayed(ms: Long, block: () -> Unit) {
    launch {
        delay(ms)
        block()
    }
}

@Composable
private fun TaskMeta(task: KTask, project: Project?, showProject: Boolean) {
    val tok = LocalTok.current
    val due = task.due
    val time = task.time
    val subs = task.subs
    if (due == null && time == null && task.notes.isEmpty() && !(showProject && project != null) && task.priority == "none" && task.pomos == 0 && !task.repeats && subs.isEmpty()) return
    val style = tok.ui(12f, c = tok.text3)
    @Composable
    fun hint(icon: String, text: String) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            KIcon(icon, 11.dp, tok.text3)
            T(text, style, maxLines = 1)
        }
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        if (task.priority != "none") Box(Modifier.padding(vertical = 5.dp).size(7.dp).background(color(priorityColors[task.priority] ?: "#5f7c8a"), CircleShape))
        if (due != null && !task.done) {
            val late = isOverdue(due)
            T((if (late) t("overdueDate", "date" to fmtDue(due)) else fmtDue(due)) + (time?.let { " · ${fmtTime(it)}" } ?: ""), style.copy(color = if (late) tok.danger else if (isToday(due)) tok.accent else tok.text2), maxLines = 1)
        }
        if (time != null && due == null && !task.done) hint("Clock", fmtTime(time))
        if (task.repeats) hint("Repeat", t("repeat_${task.repeatKind}"))
        if (subs.isNotEmpty()) hint("Checklist", "${subs.count { it.done }}/${subs.size}")
        if (task.notes.isNotEmpty()) hint("Note", t("note"))
        if (task.pomos > 0) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            FlameMark(10.dp, tok.accent, 1f)
            T("×${task.pomos}", style)
        }
        if (showProject && project != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            Box(Modifier.size(6.dp).background(color(project.color), CircleShape))
            T(project.name, style, maxLines = 1)
        }
    }
}

@Composable
private fun TaskEditor(task: KTask) {
    val store = LocalStore.current
    val tok = LocalTok.current
    var title by remember { mutableStateOf(task.title) }
    var notes by remember { mutableStateOf(task.notes) }
    var subText by remember { mutableStateOf("") }
    fun patch(p: Item) = store.dispatch { it.updateTask(task.id, p) }
    fun patchSubs(list: List<Sub>) = patch(itemOf("subs" to J.Arr(list.map { J.Obj(it.j) })))
    fun addSub() {
        val v = subText.trim()
        if (v.isEmpty()) return
        patchSubs(task.subs + Sub(v))
        subText = ""
    }
    fun saveDrafts() {
        val cur = store.state.tasks.firstOrNull { it.id == task.id } ?: return
        val p = LinkedHashMap<String, J>()
        val clean = title.trim()
        if (clean.isNotEmpty() && clean != cur.title) p["title"] = J.Str(clean)
        if (notes != cur.notes) p["notes"] = J.Str(notes)
        if (p.isNotEmpty()) patch(p)
    }
    // Save as you type, not only on close: leaving mid-sentence must not lose the edit.
    LaunchedEffect(title, notes) {
        delay(500)
        saveDrafts()
    }
    DisposableEffect(Unit) { onDispose { saveDrafts() } }

    Column(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 14.dp, top = 2.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Input(title, { title = it }, "", tok.display(25f), Modifier.fillMaxWidth(), singleLine = false)
        task.subs.forEach { s ->
            key(s.id) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        Modifier.size(22.dp).border(1.dp, if (s.done) tok.accent else tok.borderStrong, RoundedCornerShape(5.dp)).tap(label = if (s.done) t("markStepNotDone") else t("markStepDone")) {
                            patchSubs(task.subs.map { x -> if (x.id == s.id) Sub(x.j + ("done" to J.Bool(!s.done))) else x })
                        },
                        contentAlignment = Alignment.Center,
                    ) { if (s.done) T("✓", tok.ui(12f, FontWeight.Bold, tok.accent)) }
                    T(s.text, tok.ui(13.5f, c = if (s.done) tok.text3 else tok.text).copy(textDecoration = if (s.done) TextDecoration.LineThrough else null), Modifier.weight(1f))
                    IconBtn("X", t("removeStep"), 10.dp, tok.text3) { patchSubs(task.subs.filter { it.id != s.id }) }
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KIcon("Plus", 11.dp, tok.text3)
            Input(subText, { subText = it }, t("addStepPh"), tok.ui(13.5f), Modifier.weight(1f).onFocusChanged { if (!it.isFocused) addSub() }, limit = 80, onDone = { addSub() })
        }
        Box(Modifier.fillMaxWidth().heightIn(min = 64.dp).card(tok, R9).padding(10.dp)) {
            Input(notes, { notes = it }, t("addNotePh"), tok.ui(13.5f), Modifier.fillMaxWidth(), singleLine = false)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            DueField(task.due) { patch(itemOf("due" to it.j())) }
            TimeField(task.time ?: "") { patch(itemOf("time" to it.takeIf { x -> x.isNotEmpty() }.j())) }
            Menu(REPEATS.map { it to t("repeat_$it") }, { patch(itemOf("repeat" to J.Str(it))) }) {
                KIcon("Repeat", 11.dp)
                ChipText(t("repeat_${task.repeatKind}"))
            }
            PRIORITIES.forEach { (id, c) ->
                Chip(task.priority == id, { patch(itemOf("priority" to J.Str(id))) }) {
                    if (id != "none") KIcon("Flag", 11.dp, color(c))
                    ChipText(t("prio_$id"), task.priority == id)
                }
            }
            FolderMenu(task.projectId) { patch(itemOf("projectId" to J.Str(it))) }
            MiniButton(t("archive")) {
                saveDrafts()
                store.dispatch { it.updateTask(task.id, itemOf("archived" to J.Bool(true))) }
                store.toast(t("archived"), "🗄", t("undo")) { store.dispatch { it.updateTask(task.id, itemOf("archived" to J.Bool(false))) } }
            }
            MiniButton(t("delete"), danger = true) {
                saveDrafts()
                store.remove(task)
            }
        }
    }
}

@Composable
private fun EmptyState(kind: String) {
    val tok = LocalTok.current
    val icons = mapOf("search" to "🔍", "today" to "✨", "upcoming" to "🌅", "all" to "🪐", "project" to "🎯")
    val k = if (kind in icons) kind else "all"
    Column(Modifier.fillMaxWidth().padding(vertical = 56.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        T(icons.getValue(k), tok.ui(40f))
        T(t("empty_${k}_title"), tok.ui(16f, FontWeight.SemiBold))
        T(t("empty_${k}_body"), tok.ui(14f, c = tok.text2).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center))
    }
}

@Composable
fun BareEmpty(icon: String, text: String) {
    val tok = LocalTok.current
    Column(Modifier.fillMaxWidth().padding(vertical = 64.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        KIcon(icon, 22.dp, tok.text3)
        T(text, tok.ui(14f, c = tok.text2))
    }
}

@Composable
private fun ListRow(task: KTask, done: Boolean, actions: @Composable RowScope.() -> Unit) {
    val store = LocalStore.current
    val tok = LocalTok.current
    val p = store.state.projects.firstOrNull { it.id == task.projectId }
    Column(Modifier.fillMaxWidth().card(tok).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        T(task.title, tok.ui(14.5f, FontWeight.Medium, if (done) tok.text3 else tok.text).copy(textDecoration = if (done) TextDecoration.LineThrough else null))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (p != null) {
                Box(Modifier.size(6.dp).background(color(p.color), CircleShape))
                T(p.name, tok.ui(12f, c = tok.text3), maxLines = 1)
            }
            Spacer(Modifier.weight(1f))
            actions()
        }
    }
}

@Composable
fun ArchiveView() {
    val store = LocalStore.current
    val items = store.state.tasks.filter { it.archived }.sortedByDescending { it.createdAt }
    if (items.isEmpty()) return BareEmpty("Archive", t("archiveEmpty"))
    Column(Modifier.padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { x ->
            key(x.id) {
                ListRow(x, x.done) {
                    MiniButton(t("restore")) {
                        store.dispatch { it.updateTask(x.id, itemOf("archived" to J.Bool(false))) }
                        store.toast(t("restoredFromArchive"), "↩")
                    }
                    MiniButton(t("delete"), danger = true) {
                        store.dispatch { it.deleteTask(x.id) }
                        store.toast(t("movedToTrash"), "🗑")
                    }
                }
            }
        }
    }
}

@Composable
fun TrashView() {
    val store = LocalStore.current
    val tok = LocalTok.current
    val items = store.state.trash.sortedByDescending { it.deletedAt }
    if (items.isEmpty()) return BareEmpty("Trash", t("trashEmpty"))
    fun left(ms: Double): String {
        if (ms <= 0) return t("now")
        val days = (ms / 86_400_000).toInt()
        if (days >= 1) return t("daysShort", "n" to days.toString())
        val hours = (ms / 3_600_000).toInt()
        if (hours >= 1) return t("hoursShort", "n" to hours.toString())
        return t("minutesShort", "n" to maxOf(1, (ms / 60000).toInt()).toString())
    }
    Column(Modifier.padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            T(t("trashHead"), tok.ui(13f, c = tok.text2), Modifier.weight(1f))
            MiniButton(t("emptyNow"), danger = true) {
                val was = store.state.trash
                store.dispatch { it.copy(trash = emptyList()) }
                store.toast(tn("erasedTasks", was.size), "🗑", t("undo")) { store.dispatch { it.restoreTrash(was) } }
            }
        }
        items.forEach { x ->
            key(x.id) {
                ListRow(x, true) {
                    T(left(maxOf(0.0, x.deletedAt + TRASH_TTL - Clock.ms)), tok.mono(11.5f))
                    MiniButton(t("restore")) {
                        store.dispatch { it.restoreTasks(listOf(x.id)) }
                        store.toast(t("restored"), "↩")
                    }
                    MiniButton(t("deleteNow"), danger = true) { store.dispatch { it.purgeTrash(x.id) } }
                }
            }
        }
    }
}
