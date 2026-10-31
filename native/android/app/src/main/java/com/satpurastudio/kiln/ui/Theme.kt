@file:OptIn(ExperimentalLayoutApi::class, androidx.compose.ui.text.ExperimentalTextApi::class)

package com.satpurastudio.kiln.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.satpurastudio.kiln.R
import com.satpurastudio.kiln.Store
import com.satpurastudio.kiln.core.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.graphics.SolidColor

fun color(hex: String, alpha: Float = 1f): Color {
    val (r, g, b) = hexRGB(hex)
    return Color(r / 255f, g / 255f, b / 255f, alpha)
}

private val Figtree = FontFamily(
    Font(R.font.figtree, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.figtree, FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.figtree, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.figtree, FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))),
)
private val Bebas = FontFamily(Font(R.font.bebas_neue))
private val Mono = FontFamily(Font(R.font.dm_mono, FontWeight.Normal), Font(R.font.dm_mono_medium, FontWeight.Medium))

/** The design tokens from index.css, resolved for the current theme, accent and text size. */
@Immutable
data class Tok(val dark: Boolean = false, val accentHex: String = "#d85a30", val accent2Hex: String = "#ea6840", val deepHex: String = "#c24a24", val scale: Float = 1f) {
    private val ink = if (dark) Color(0xFFF4EFE6) else Color(0xFF2A2620)
    val accent = color(accentHex)
    val accent2 = color(accent2Hex)
    val deep = color(deepHex)
    val danger = Color(0xFFC43D2B)
    val bg = if (dark) Color(0xFF0E0B08) else Color(0xFFF4EFE6)
    val raise = if (dark) Color(0xFF181310) else Color.White
    val panel = if (dark) ink.copy(alpha = 0.035f) else Color.White.copy(alpha = 0.7f)
    val panelHover = if (dark) ink.copy(alpha = 0.07f) else Color.White.copy(alpha = 0.98f)
    val panelStrong = if (dark) Color(0xEB181310) else Color(0xF0FFFFFF)
    val border = ink.copy(alpha = if (dark) 0.08f else 0.12f)
    val borderStrong = ink.copy(alpha = if (dark) 0.2f else 0.28f)
    val text = ink
    val text2 = ink.copy(alpha = 0.62f)
    val text3 = ink.copy(alpha = if (dark) 0.38f else 0.42f)
    val dot = ink.copy(alpha = if (dark) 0.045f else 0.055f)
    val scrim = if (dark) Color.Black.copy(alpha = 0.55f) else ink.copy(alpha = 0.4f)

    fun ui(size: Float, weight: FontWeight = FontWeight.Normal, c: Color = text) = TextStyle(fontFamily = Figtree, fontSize = (size * scale).sp, fontWeight = weight, color = c)
    fun mono(size: Float, medium: Boolean = false, c: Color = text3) = TextStyle(fontFamily = Mono, fontSize = (size * scale).sp, fontWeight = if (medium) FontWeight.Medium else FontWeight.Normal, color = c)
    /** Display sizes are not scaled by the text-size setting, as on the web. */
    fun display(size: Float, c: Color = text) = TextStyle(fontFamily = Bebas, fontSize = size.sp, color = c, letterSpacing = 0.6.sp)

    companion object {
        fun of(s: AppState): Tok {
            val a = resolveAccent(s.settings)
            return Tok(s.theme == "dark", a.accent, a.accent2, a.deep, s.textScale.toFloat())
        }
    }
}

val LocalTok = staticCompositionLocalOf { Tok() }
val LocalStore = staticCompositionLocalOf<Store> { error("no store") }

val R12 = RoundedCornerShape(12.dp)
val R9 = RoundedCornerShape(9.dp)

fun Modifier.card(tok: Tok, shape: androidx.compose.ui.graphics.Shape = R12, fill: Color = tok.panel, line: Color = tok.border) =
    background(fill, shape).border(BorderStroke(1.dp, line), shape).clip(shape)

/** Plain tap with no ripple: kiln's own states show what's selected. */
@Composable
fun Modifier.tap(enabled: Boolean = true, label: String? = null, onClick: () -> Unit): Modifier {
    val src = remember { MutableInteractionSource() }
    val m = clickable(interactionSource = src, indication = null, enabled = enabled, onClick = onClick)
    return if (label != null) m.semantics { contentDescription = label } else m
}

@Composable
fun T(text: String, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE) {
    BasicText(text, modifier, style, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

private val iconCache = HashMap<String, ImageVector>()

private fun iconVector(name: String): ImageVector = iconCache.getOrPut(name) {
    val nodes = PathParser().parsePathString(ICON_PATHS[name] ?: "").toNodes()
    ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).addPath(
        nodes, fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = 1.7f,
        strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
    ).build()
}

@Composable
fun KIcon(name: String, size: Dp = 16.dp, tint: Color = LocalTok.current.text2, modifier: Modifier = Modifier) {
    Image(rememberVectorPainter(iconVector(name)), null, modifier.size(size), colorFilter = ColorFilter.tint(tint))
}

@Composable
fun IconBtn(name: String, label: String, size: Dp = 16.dp, tint: Color? = null, onClick: () -> Unit) {
    Box(Modifier.size(38.dp).tap(label = label, onClick = onClick), contentAlignment = Alignment.Center) {
        KIcon(name, size, tint ?: LocalTok.current.text2)
    }
}

/** kiln's brand mark, flattened from the SVG in Icons.jsx (shared/flame.json). */
private val FLAME = floatArrayOf(9.881f, 14.5f, 11f, 13.381f, 11f, 12f, 11f, 10.62f, 10.5f, 10f, 10f, 9f, 8.928f, 6.857f, 9.776f, 4.946f, 12f, 3f, 12.5f, 5.5f, 14f, 7.9f, 16f, 9.5f, 18f, 11.1f, 19f, 13f, 19f, 15f, 19f, 18.866f, 15.866f, 22f, 12f, 22f, 8.134f, 22f, 5f, 18.866f, 5f, 15f, 5f, 13.847f, 5.433f, 12.706f, 6f, 12f, 6f, 13.381f, 7.119f, 14.5f, 8.5f, 14.5f)

fun flamePath(size: Size): Path {
    val k = minOf(size.width, size.height) / 24f
    return Path().apply {
        moveTo(8.5f * k, 14.5f * k)
        var i = 0
        while (i < FLAME.size) {
            cubicTo(FLAME[i] * k, FLAME[i + 1] * k, FLAME[i + 2] * k, FLAME[i + 3] * k, FLAME[i + 4] * k, FLAME[i + 5] * k)
            i += 6
        }
        close()
    }
}

@Composable
fun BrandMark(size: Dp = 32.dp) {
    val tok = LocalTok.current
    Box(
        Modifier.size(size).background(Brush.linearGradient(listOf(tok.accent2, tok.deep)), RoundedCornerShape(size * 0.3f)),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(size * 0.55f)) { drawPath(flamePath(this.size), Color.White, style = Stroke(this.size.width * 0.09f, cap = StrokeCap.Round, join = StrokeJoin.Round)) }
    }
}

@Composable
fun FlameMark(size: Dp, tint: Color, width: Float = 1.4f) {
    Canvas(Modifier.size(size)) { drawPath(flamePath(this.size), tint, style = Stroke(width.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)) }
}

/** Warm paper with two faint accent glows and the dot grid. Drawn once, no blur, no timers. */
@Composable
fun Backdrop() {
    val tok = LocalTok.current
    Canvas(Modifier.fillMaxSize()) {
        drawRect(tok.bg)
        val m = maxOf(size.width, size.height)
        drawRect(Brush.radialGradient(listOf(tok.accent.copy(alpha = 0.06f), Color.Transparent), Offset(size.width * 0.1f, size.height * 0.15f), m * 0.36f))
        drawRect(Brush.radialGradient(listOf(tok.accent.copy(alpha = 0.05f), Color.Transparent), Offset(size.width * 0.9f, size.height * 0.8f), m * 0.38f))
        val step = 26.dp.toPx()
        val r = 0.75.dp.toPx()
        var x = step / 2
        while (x < size.width) {
            var y = step / 2
            while (y < size.height) {
                drawCircle(tok.dot, r, Offset(x, y))
                y += step
            }
            x += step
        }
    }
}

@Composable
fun ProgressRing(size: Dp = 18.dp, stroke: Dp = 2.5.dp, pct: Float, tint: Color? = null) {
    val tok = LocalTok.current
    val c = tint ?: tok.accent
    Canvas(Modifier.size(size)) {
        val w = stroke.toPx()
        val inset = w / 2
        val s = Size(this.size.width - w, this.size.height - w)
        drawArc(tok.borderStrong, 0f, 360f, false, Offset(inset, inset), s, style = Stroke(w))
        drawArc(c, -90f, 360f * pct / 100f, false, Offset(inset, inset), s, style = Stroke(w, cap = StrokeCap.Round))
    }
}

@Composable
fun CheckCircle(checked: Boolean, tint: Color, onToggle: () -> Unit) {
    val rest = Color(0x8C8E8478)
    val label = if (checked) t("markIncomplete") else t("markComplete")
    Box(Modifier.size(44.dp).tap(label = label, onClick = onToggle), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(22.dp)) {
            val k = size.width / 22f
            if (checked) drawCircle(tint)
            drawCircle(if (checked) tint else rest, style = Stroke(1.5.dp.toPx()), radius = size.width / 2 - 0.75.dp.toPx())
            if (checked) {
                val p = Path().apply {
                    moveTo(6.9f * k, 11.5f * k)
                    lineTo(9.5f * k, 14.2f * k)
                    lineTo(15.1f * k, 8.4f * k)
                }
                drawPath(p, Color.White, style = Stroke(1.9.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
            }
        }
    }
}

@Composable
fun Chip(on: Boolean = false, onClick: () -> Unit, content: @Composable RowScope.() -> Unit) {
    val tok = LocalTok.current
    Row(
        Modifier.heightIn(min = 32.dp).background(if (on) tok.accent.copy(alpha = 0.12f) else Color.Transparent, CircleShape)
            .border(1.dp, if (on) tok.accent.copy(alpha = 0.6f) else tok.border, CircleShape).clip(CircleShape).tap(onClick = onClick).padding(horizontal = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        content = content,
    )
}

@Composable
fun ChipText(text: String, on: Boolean = false) {
    val tok = LocalTok.current
    T(text, tok.ui(13f, FontWeight.Medium, if (on) tok.accent else tok.text2), maxLines = 1)
}

@Composable
fun PrimaryButton(title: String, modifier: Modifier = Modifier, busy: Boolean = false, onClick: () -> Unit) {
    val tok = LocalTok.current
    Box(
        modifier.heightIn(min = 44.dp).clip(R12).background(Brush.verticalGradient(listOf(tok.accent, tok.deep))).tap(enabled = !busy, onClick = onClick).padding(horizontal = 18.dp),
        contentAlignment = Alignment.Center,
    ) { T(title, tok.ui(14f, FontWeight.SemiBold, if (busy) Color.White.copy(alpha = 0.6f) else Color.White), maxLines = 1) }
}

@Composable
fun GhostButton(title: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val tok = LocalTok.current
    Box(modifier.heightIn(min = 44.dp).border(1.dp, tok.border, R12).clip(R12).tap(onClick = onClick).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        T(title, tok.ui(14f, FontWeight.Medium, tok.text2), maxLines = 1)
    }
}

@Composable
fun MiniButton(title: String, danger: Boolean = false, primary: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val tok = LocalTok.current
    val shape = RoundedCornerShape(8.dp)
    Box(
        Modifier.heightIn(min = 32.dp).background(if (primary) tok.accent else Color.Transparent, shape).border(1.dp, if (danger) tok.danger.copy(alpha = 0.4f) else tok.border, shape)
            .clip(shape).tap(enabled = enabled, onClick = onClick).padding(horizontal = 11.dp),
        contentAlignment = Alignment.Center,
    ) { T(title, tok.ui(12.5f, FontWeight.Medium, if (primary) Color.White else if (danger) tok.danger else tok.text2), maxLines = 1) }
}

/** A plain text input with kiln's placeholder and caret. */
@Composable
fun Input(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    style: TextStyle,
    modifier: Modifier = Modifier,
    limit: Int? = null,
    secure: Boolean = false,
    keyboard: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    onDone: (() -> Unit)? = null,
) {
    val tok = LocalTok.current
    BasicTextField(
        value,
        { v -> onChange(if (limit != null && v.length > limit) v.take(limit) else v) },
        modifier,
        textStyle = style,
        singleLine = singleLine,
        cursorBrush = SolidColor(tok.accent),
        keyboardOptions = KeyboardOptions(keyboardType = if (secure) KeyboardType.Password else keyboard, imeAction = if (singleLine) ImeAction.Done else ImeAction.Default),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        visualTransformation = if (secure) PasswordVisualTransformation() else VisualTransformation.None,
        decorationBox = { inner ->
            Box(contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) T(placeholder, style.copy(color = tok.text3), maxLines = if (singleLine) 1 else Int.MAX_VALUE)
                inner()
            }
        },
    )
}

@Composable
fun KField(value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier, limit: Int? = null, secure: Boolean = false, keyboard: KeyboardType = KeyboardType.Text, onDone: (() -> Unit)? = null) {
    val tok = LocalTok.current
    Box(modifier.fillMaxWidth().heightIn(min = 46.dp).card(tok, RoundedCornerShape(11.dp)).padding(horizontal = 13.dp), contentAlignment = Alignment.CenterStart) {
        Input(value, onChange, placeholder, tok.ui(15f), Modifier.fillMaxWidth(), limit, secure, keyboard, onDone = onDone)
    }
}
