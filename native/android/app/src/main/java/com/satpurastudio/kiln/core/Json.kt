package com.satpurastudio.kiln.core

import androidx.compose.runtime.Immutable

/**
 * Every synced record stays plain JSON, so a field added by a newer web build
 * survives a round trip through an older app, and the merge can treat fields
 * generically the way merge.js does. A small parser of our own: nothing to
 * initialise at launch and nothing for R8 to keep.
 */
@Immutable
sealed class J {
    data object Null : J()
    data class Bool(val v: Boolean) : J()
    data class Num(val v: Double) : J()
    data class Str(val v: String) : J()
    data class Arr(val v: List<J>) : J()
    data class Obj(val v: Map<String, J>) : J()

    val string get() = (this as? Str)?.v
    val number get() = (this as? Num)?.v
    val boolean get() = (this as? Bool)?.v
    val array get() = (this as? Arr)?.v
    val obj get() = (this as? Obj)?.v
    operator fun get(key: String): J? = obj?.get(key)

    /** merge.js stableStringify: sorted keys, JS number and string formatting. */
    val stable: String get() = StringBuilder().also { write(it) }.toString()

    private fun write(b: StringBuilder) {
        when (this) {
            Null -> b.append("null")
            is Bool -> b.append(v)
            is Num -> b.append(jsNumber(v))
            is Str -> jsString(v, b)
            is Arr -> {
                b.append('[')
                v.forEachIndexed { i, x ->
                    if (i > 0) b.append(',')
                    x.write(b)
                }
                b.append(']')
            }
            is Obj -> {
                b.append('{')
                v.keys.sorted().forEachIndexed { i, k ->
                    if (i > 0) b.append(',')
                    jsString(k, b)
                    b.append(':')
                    v.getValue(k).write(b)
                }
                b.append('}')
            }
        }
    }

    companion object {
        fun parse(text: String): J? = try {
            Parser(text).parseDocument()
        } catch (_: Exception) {
            null
        }

        private fun jsNumber(v: Double): String {
            if (v == Math.rint(v) && Math.abs(v) < 1e21) return java.math.BigDecimal(v).toBigInteger().toString()
            val s = v.toString() // shortest round-trip, like JS, apart from the exponent's spelling
            val e = s.indexOf('E')
            if (e < 0) return s
            val mantissa = s.substring(0, e).removeSuffix(".0")
            val exp = s.substring(e + 1)
            return mantissa + "e" + (if (exp.startsWith("-")) exp else "+$exp")
        }

        private fun jsString(s: String, b: StringBuilder) {
            b.append('"')
            for (c in s) when {
                c == '"' -> b.append("\\\"")
                c == '\\' -> b.append("\\\\")
                c == '\n' -> b.append("\\n")
                c == '\r' -> b.append("\\r")
                c == '\t' -> b.append("\\t")
                c == '\b' -> b.append("\\b")
                c == '\u000C' -> b.append("\\f")
                c < ' ' -> b.append("\\u").append(c.code.toString(16).padStart(4, '0'))
                else -> b.append(c)
            }
            b.append('"')
        }
    }

    private class Parser(private val s: String) {
        private var i = 0

        fun parseDocument(): J {
            val v = value()
            ws()
            require(i == s.length)
            return v
        }

        private fun ws() {
            while (i < s.length && s[i] in " \t\r\n") i++
        }

        private fun value(): J {
            ws()
            return when (s[i]) {
                '{' -> {
                    i++
                    val m = LinkedHashMap<String, J>()
                    ws()
                    if (s[i] == '}') {
                        i++
                    } else {
                        while (true) {
                            ws()
                            val k = str()
                            ws()
                            require(s[i++] == ':')
                            m[k] = value()
                            ws()
                            if (s[i] == ',') i++ else {
                                require(s[i++] == '}')
                                break
                            }
                        }
                    }
                    Obj(m)
                }
                '[' -> {
                    i++
                    val l = ArrayList<J>()
                    ws()
                    if (s[i] == ']') {
                        i++
                    } else {
                        while (true) {
                            l.add(value())
                            ws()
                            if (s[i] == ',') i++ else {
                                require(s[i++] == ']')
                                break
                            }
                        }
                    }
                    Arr(l)
                }
                '"' -> Str(str())
                't' -> literal("true", Bool(true))
                'f' -> literal("false", Bool(false))
                'n' -> literal("null", Null)
                else -> {
                    val start = i
                    while (i < s.length && s[i] in "+-0123456789.eE") i++
                    Num(s.substring(start, i).toDouble())
                }
            }
        }

        private fun literal(word: String, v: J): J {
            require(s.startsWith(word, i))
            i += word.length
            return v
        }

        private fun str(): String {
            require(s[i++] == '"')
            val b = StringBuilder()
            while (true) {
                val c = s[i++]
                when (c) {
                    '"' -> return b.toString()
                    '\\' -> when (val e = s[i++]) {
                        'n' -> b.append('\n')
                        'r' -> b.append('\r')
                        't' -> b.append('\t')
                        'b' -> b.append('\b')
                        'f' -> b.append('\u000C')
                        'u' -> {
                            b.append(s.substring(i, i + 4).toInt(16).toChar())
                            i += 4
                        }
                        else -> b.append(e)
                    }
                    else -> b.append(c)
                }
            }
        }
    }
}

typealias Item = Map<String, J>

fun String?.j(): J = if (this == null) J.Null else J.Str(this)
fun Int.j(): J = J.Num(toDouble())
fun Double.j(): J = J.Num(this)
fun Boolean.j(): J = J.Bool(this)
fun Item.j(): J = J.Obj(this)
fun jsonOf(vararg p: Pair<String, J>): J = J.Obj(linkedMapOf(*p))
fun itemOf(vararg p: Pair<String, J>): Item = linkedMapOf(*p)
