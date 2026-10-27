import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore, toast } from '../store'
import { PROJECT_COLORS, PROJECT_ICONS, iconGlyph } from '../utils'
import { t, tn } from '../i18n'

export default function ProjectModal({ mode, project, onClose }) {
  const { state, dispatch } = useStore()
  const editing = mode === 'edit'
  const [name, setName] = useState(editing ? project.name : '')
  const [color, setColor] = useState(editing ? project.color : PROJECT_COLORS[0])
  const [icon, setIcon] = useState(editing ? project.icon : PROJECT_ICONS[0])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  // Escape closes, like every other overlay
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!name.trim()) {
      inputRef.current?.focus()
      return
    }
    if (editing) {
      dispatch({ type: 'UPDATE_PROJECT', id: project.id, patch: { name: name.trim(), color, icon } })
      toast(t('folderUpdated'), '✓')
    } else {
      dispatch({ type: 'ADD_PROJECT', name, color, icon })
      toast(t('folderCreated', { name: name.trim() }), iconGlyph(icon))
    }
    onClose()
  }

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const index = state.projects.findIndex((p) => p.id === project.id)
    const taskIds = state.tasks.filter((t) => t.projectId === project.id).map((t) => t.id)
    dispatch({ type: 'DELETE_PROJECT', id: project.id })
    toast(
      taskIds.length ? tn('folderDeletedTasks', taskIds.length) : t('folderDeleted'),
      '🗑',
      { label: t('undo'), fn: () => dispatch({ type: 'RESTORE_PROJECT', project, index, taskIds }) }
    )
    onClose()
  }

  const customColor = !PROJECT_COLORS.includes(color)

  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName === 'INPUT') submit()
        }}
      >
        <h2>{editing ? t('editFolder') : t('newFolder')}</h2>

        <label>{t('name')}</label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          maxLength={40}
          placeholder={t('folderNamePh')}
          onChange={(e) => setName(e.target.value)}
        />

        <label>{t('color')}</label>
        <div className="swatch-row">
          {PROJECT_COLORS.map((c) => (
            <motion.button
              key={c}
              className={`swatch ${color === c ? 'on' : ''}`}
              style={{ background: c, color: c }}
              onClick={() => setColor(c)}
              whileTap={{ scale: 0.85 }}
              aria-label={t('useColor', { color: c })}
            />
          ))}
          <label
            className={`swatch swatch-custom ${customColor ? 'on' : ''}`}
            style={customColor ? { background: color, color } : undefined}
            title={t('pickCustomColor')}
          >
            {!customColor && <span className="swatch-custom-plus">+</span>}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>

        <label>{t('icon')}</label>
        <div className="icon-row">
          {PROJECT_ICONS.map((i) => (
            <motion.button
              key={i}
              className={`icon-choice ${icon === i ? 'on' : ''}`}
              style={icon === i ? { color } : undefined}
              onClick={() => setIcon(i)}
              whileTap={{ scale: 0.85 }}
            >
              {iconGlyph(i)}
            </motion.button>
          ))}
        </div>

        <div className="modal-actions">
          {editing && (
            <button className="danger-btn" style={{ marginRight: 'auto', height: 38 }} onClick={remove}>
              {confirmDelete ? t('deleteFolderConfirm') : t('delete')}
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <motion.button className="btn primary" onClick={submit} whileTap={{ scale: 0.96 }}>
            {editing ? t('save') : t('createFolder')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
