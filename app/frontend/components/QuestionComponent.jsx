import {
    Box,
    Card,
    Checkbox,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputBase,
    InputLabel,
    MenuItem,
    Popover,
    Radio,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import {useEffect, useState, useRef} from "react";
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { apiJson } from '../api/http.js'
import { updateQuestionTitle, deleteQuestion as deleteQuestionApi, addElement as addQuestionElement, updateElement, deleteElement as deleteElementApi } from '../api/questions.js'

function getElementKey(el, idx) {
    if (el && el.id !== undefined && el.id !== null && el.id !== '') {
        return String(el.id)
    }
    return `idx-${idx}`
}

function normalizeExternalAnswer(answer, elements) {
    if (Array.isArray(answer)) {
        return answer.map(item => {
            const raw = String(item)
            const match = elements.find((el, idx) => {
                const key = getElementKey(el, idx)
                return key === raw || String(idx) === raw
            })
            return match ? getElementKey(match, elements.indexOf(match)) : item
        })
    }
    if (typeof answer === 'string') {
        const match = elements.find((el, idx) => {
            const key = getElementKey(el, idx)
            return key === answer || String(idx) === answer
        })
        return match ? getElementKey(match, elements.indexOf(match)) : answer
    }
    return answer
}

function QuestionComponent({ data, index, onRefresh, readOnly = false, onAnswerChange, externalAnswer }) {
    const [editing, setEditing] = useState(false);
    const [question, setQuestion] = useState(data || {});
    const [elements, setElements] = useState((data && data.elements) || []);
    const [answers, setAnswers] = useState({});
    const [customElement, setCustomElement] = useState(null);
    const [customAnchorEl, setCustomAnchorEl] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const draggingIndexRef = useRef(null);

    useEffect(() => {
        const nextQuestion = data || {};
        const nextElements = ((nextQuestion && nextQuestion.elements) || []).map(el => {
            if (el && Number(el.evaluatingType) === 4) return { ...el, evaluatingType: 3 };
            return el;
        }).slice().sort((a, b) => {
            const pa = Number(a && a.priority || 0);
            const pb = Number(b && b.priority || 0);
            return pa - pb;
        });
        setQuestion(nextQuestion);
        setElements(nextElements);
        const qId = data?.id || index;
        const qKey = `ans_q${qId}`;
        const normalizedAnswer = externalAnswer !== undefined ? normalizeExternalAnswer(externalAnswer, nextElements) : null;
        setAnswers({ [qKey]: normalizedAnswer });
    }, [data, index, externalAnswer]);

    // propagate answers up when they change
    useEffect(() => {
        if (typeof onAnswerChange !== 'function') return
        const qId = data?.id || index
        const qKey = `ans_q${qId}`
        if (answers && Object.prototype.hasOwnProperty.call(answers, qKey)) {
          try { onAnswerChange(qId, answers[qKey]) } catch (e) { /* ignore */ }
        }
    }, [answers, data, index, onAnswerChange]);

    useEffect(() => {
        if (readOnly && editing) setEditing(false);
    }, [readOnly, editing]);


    async function saveTitle(title) {
        if (readOnly) return false;
        if (!question.id) {
            setQuestion({ ...question, title });
            return false;
        }
        try {
            await updateQuestionTitle(question.id, { title });
            setQuestion(q => ({ ...q, title }));
            if (onRefresh) onRefresh();
            return true;
        } catch {
            return false;
        }
    }

    async function addElement() {
        if (readOnly) return;
        const currentEls = Array.isArray(elements) && elements.length ? elements : (question.elements || []);
        if (currentEls.length >= 8) {
            console.warn('Limite de 8 sous-questions atteinte');
            return;
        }
        if (!question.id) {
            const els = [...currentEls, { id: `tmp-${Date.now()}`, title: 'Nouvel élément', type: 'radio', priority: currentEls.length, evaluatingType: 0, evaluatingValue: 0 }];
            setElements(els);
            setQuestion({ ...question, elements: els });
            return;
        }
        try {
            await addQuestionElement(question.id, { type: 'radio', title: 'Nouvel élément', priority: 0, evaluatingType: 0, evaluatingValue: 0 });
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error('addElement failed', e);
        }
    }

    async function saveElement(elId, payload) {
        if (readOnly) return;
        const isTmp = !elId || String(elId).startsWith('tmp-');
        const apply = els => els.map(el => el.id === elId ? { ...el, ...payload } : el);
        setElements(apply); setQuestion(q => ({ ...q, elements: apply(q.elements || []) }));
        if (!isTmp) try { await updateElement(elId, payload); onRefresh?.(); } catch {}
    }

    async function deleteQuestion() {
        if (readOnly) return false;
        if (!question.id) return false;
        if (!confirm('Supprimer la question ?')) return false;
        try {
            await deleteQuestionApi(question.id);
            if (onRefresh) onRefresh();
            else setQuestion(null);
            return true;
        } catch {
            return false;
        }
    }

    async function deleteElement(elId) {
        if (readOnly) return false;
        if (!elId) return false;
        if (!confirm("Supprimer l'élément ?")) return false;
        if (String(elId).startsWith('tmp-')) {
            setElements(els => els.filter(el => el.id !== elId));
            setQuestion(q => ({ ...q, elements: (q.elements || []).filter(el => el.id !== elId) }));
            return true;
        }
        try {
            await deleteElementApi(elId);
            setElements(els => els.filter(el => el.id !== elId));
            setQuestion(q => ({ ...q, elements: (q.elements || []).filter(el => el.id !== elId) }));
            if (onRefresh) onRefresh();
            return true;
        } catch {
            return false;
        }
    }

    function openElementMenu(event, el) {
        if (readOnly) return;
        const rawEvalType = Number(el.evaluatingType || 0);
        setCustomAnchorEl(event.currentTarget);
        setCustomElement({
            ...el,
            type: el.type || 'radio',
            priority: Number(el.priority || 0),
            evaluatingType: rawEvalType === 4 ? 3 : rawEvalType,
            evaluatingValue: Number(el.evaluatingValue || 0),
        });
    }

    function closeElementMenu() {
        setCustomAnchorEl(null);
        setCustomElement(null);
    }

    async function updateCustomElement(patch) {
        if (readOnly) return;
        if (!customElement) return;
        const nextElement = { ...customElement, ...patch };
        const evaluatingType = Number(nextElement.evaluatingType || 0);
        const evaluatingValue = (evaluatingType === 0 || evaluatingType === 5) ? 0 : Number(nextElement.evaluatingValue || 0);
        const payload = {
            title: nextElement.title || '',
            type: nextElement.type || 'radio',
            priority: Number(nextElement.priority || 0),
            evaluatingType,
            evaluatingValue,
        };

        setCustomElement({ ...nextElement, evaluatingType, evaluatingValue });

if (patch.type === 'radio' || patch.type === 'checkbox') {
    const newEls = elements.map(el => ({
        ...el,
        ...(el.id === nextElement.id ? payload : {}),
        type: el.type === 'text' ? 'text' : patch.type
    }));

    setElements(newEls);
    setQuestion(q => ({ ...q, elements: newEls }));

    await Promise.all(
        newEls.map(el =>
            el.id && !String(el.id).startsWith('tmp-')
                ? updateElement(
                    el.id,
                    el.id === nextElement.id
                        ? payload
                        : { type: el.type }
                  ).catch(() => null)
                : null
        )
    );
} else {
    await saveElement(nextElement.id, payload);
}
    }

    function renderElement(el, idx) {
        const isLast = idx === elements.length - 1;
        const qId = data?.id || index;
        const qKey = `ans_q${qId}`;
        const qAns = answers[qKey];
        const elId = getElementKey(el, idx);
        const hasTextElements = elements && elements.some(e => e.type === 'text');
        const isTextAnswer = hasTextElements && typeof qAns === 'string' && qAns.trim().length > 0 && !elements.some((other, otherIdx) => other.type !== 'text' && getElementKey(other, otherIdx) === qAns);
        const textValue = isTextAnswer ? qAns : '';
        const hasTextContent = isTextAnswer;

        if ((el && el.type) === 'checkbox') {
            const checked = Array.isArray(qAns) ? qAns.includes(elId) : false;
            return (
                <FormControlLabel
                    key={el.id || idx}
                    control={<Checkbox 
                        checked={checked} 
                        disabled={hasTextContent}
                        onChange={(event) => {
                        setAnswers(prev => {
                            if (hasTextContent) return prev;

                            const arr = Array.isArray(prev[qKey]) ? [...prev[qKey]] : [];
                            if (event.target.checked) {
                                if (!arr.includes(elId)) arr.push(elId);
                            } else {
                                const i = arr.indexOf(elId);
                                if (i >= 0) arr.splice(i, 1);
                            }
                            return { ...prev, [qKey]: arr };
                        });
                    }} />}
                    label={el.title}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.95rem' }, mb: isLast ? 2 : 0 }}
                />
            );
        }

        if ((el && el.type) === 'text') {
            return (
                <Box key={el.id || idx} sx={{ width: '100%', mt: el.type === 'text' ? 0.55 : 0, }}>
                    <InputBase
                        value={textValue}
                        onChange={(event) => setAnswers(prev => ({ ...prev, [qKey]: event.target.value }))}
                        placeholder={el.title}
                        sx={{ width: '100%', px: 1, py: 0.5, bgcolor: 'transparent', borderRadius: 1, border: '1px solid rgba(0,0,0,0.10)' }}
                    />
                </Box>
            );
        }

        return (
            <FormControlLabel
                key={el.id || idx}
                value={elId}
                control={<Radio 
                    checked={!hasTextContent && qAns === elId} 
                    disabled={hasTextContent}
                    onChange={() => {
                        if (!hasTextContent) {
                            setAnswers(prev => ({ ...prev, [qKey]: elId }));
                        }
                    }} 
                    sx={{ '& .MuiSvgIcon-root': { fontSize: 21 } }} 
                />}
                label={el.title}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.95rem' }, mb: isLast ? 2 : 0 }}
            />
        );
    }

    const noteType = Number(customElement?.evaluatingType || 0);
    const noteValueDisabled = [0, 5].includes(noteType);

    return (
        <Card
            //elevation={0.5}
            sx={{
                borderRadius: 4,
                p: 2.5,
                width: { xs: '100%', sm: 'auto' },
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: 0,
                overflow: 'hidden',
                //border: readOnly ? 'none' : '1px solid rgba(0,0,0,0.12)',
            }}
        >
            <Stack spacing={0.5} sx={{ justifyContent: "flex-start", alignItems: "flex-start", pb: 1, width: '100%', flex: 1, minHeight: 0, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flex: '0 0 auto' }}>
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 400 }}>Question {index}</Typography>
                    <Box>
                        {!readOnly && (
                            <>
                                {question.id && editing && <IconButton size="small" onClick={deleteQuestion}><DeleteIcon sx={{ color: 'red' }} fontSize="small" /></IconButton>}
                                {editing && (
                                    <IconButton
                                        size="small"
                                        onClick={addElement}
                                        disabled={(Array.isArray(elements) ? elements.length : (question.elements || []).length) >= 8}
                                        title="Ajouter une sous-question"
                                    >
                                        <AddIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton size="small" onClick={() => {
                                    if (editing) {
                                        const el = document.getElementById(`qc-title-${question.id || index}`);
                                        const title = el ? el.innerText.trim() : question.title;
                                        saveTitle(title);
                                    }
                                    setEditing(isEditing => !isEditing);
                                }}>{editing ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}</IconButton>
                            </>
                        )}
                    </Box>
                </Box>

                {!editing && (
                    <>
                        <Typography variant="subtitle1" sx={{ color: 'text.primary', pb: 1.5, fontSize: 16, fontWeight: 500, flex: '0 0 auto' }}>{question.title}</Typography>
                        <Stack
                            sx={{
                                justifyContent: "flex-start",
                                alignItems: "flex-start",
                                width: '100%',
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                pr: 0.5,
                                pb: 1,
                                scrollbarWidth: 'none',
                                '&::-webkit-scrollbar': { width: 0, height: 0 },
                            }}
                        >
                            {elements && elements.length > 0 ? (
                                elements.map(renderElement)
                            ) : (
                                <Box sx={{ width: '100%', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography sx={{ color: 'text.secondary', fontSize: 13, fontStyle: 'italic' }}>Aucune sous-question ajoutée</Typography>
                                </Box>
                            )}
                        </Stack>
                    </>
                )}

                {editing && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <Box
                            id={`qc-title-${question.id || index}`}
                            component="div"
                            contentEditable
                            suppressContentEditableWarning
                            role="textbox"
                            onBlur={(event) => saveTitle(event.target.innerText)}
                            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.target.blur(); } }}
                            onPaste={(event) => {
                                event.preventDefault();
                                const text = (event.clipboardData || window.clipboardData).getData('text');
                                document.execCommand ? document.execCommand('insertText', false, text) : (event.target.innerText += text);
                            }}
                            sx={{ mb: 1, width: '100%', px: 0, py: 0, fontSize: 16, fontWeight: 500, bgcolor: 'transparent', border: 'none', outline: 'none', '&:focus': { outline: 'none' } }}
                        >
                            {question.title}
                        </Box>



                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                pr: 0.5,
                                pb: 0.2,
                                scrollbarWidth: 'none',
                                '&::-webkit-scrollbar': { width: 0, height: 0 },
                            }}
                        >
                            {(elements || question.elements || []).map((el, idx) => (

                                <Box
                                    key={el.id || idx}
                                    data-idx={idx}
                                    onDragOver={(e) => { if (readOnly) return; e.preventDefault(); setDragOverIndex(idx) }}
                                    onDragEnter={(e) => { if (readOnly) return; e.preventDefault(); setDragOverIndex(idx) }}
                                    onDragLeave={() => { if (readOnly) return; setDragOverIndex(null) }}
                                    onDrop={async (e) => {
                                        if (readOnly) return
                                        e.preventDefault(); setDragOverIndex(null)

                                        const srcStr = e.dataTransfer.getData('text/element-index')
                                        const srcIdx = (typeof srcStr === 'string' && srcStr !== '') ? Number(srcStr) : draggingIndexRef.current
                                        if (typeof srcIdx !== 'number' || isNaN(srcIdx) ) return

                                        // compute desired insertion index based on pointer position (before/after)
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const insertAfter = (e.clientY - rect.top) > (rect.height / 2)
                                        let insertIdx = insertAfter ? idx + 1 : idx

                                        // build next array and adjust for removal shifting
                                        const next = Array.isArray(elements) ? [...elements] : [...(question.elements || [])]
                                        const [moved] = next.splice(srcIdx, 1)
                                        // if source index is before insertion point, the insertion index decreases by 1 after removal
                                        if (srcIdx < insertIdx) insertIdx = insertIdx - 1
                                        next.splice(insertIdx, 0, moved)

                                        setElements(next)
                                        setQuestion(q => ({ ...q, elements: next }))

                                        // update priorities on server for elements with real ids
                                        try {
                                          const updates = next.map((it, i) => {
                                            if (!it || String(it.id || '').startsWith('tmp-')) return null
                                            return updateElement(it.id, { priority: i }).catch(() => null)
                                          })
                                          await Promise.all(updates.filter(Boolean))

                                          // fetch the authoritative question from server and apply its elements order
                                          try {
                                            if (question && question.id) {
                                              const serverQuestion = await apiJson(`/api/questions/${question.id}`)
                                              const serverEls = ((serverQuestion && serverQuestion.elements) || []).slice().sort((a, b) => (Number(a.priority || 0) - Number(b.priority || 0)))
                                              setElements(serverEls)
                                              setQuestion(serverQuestion)
                                            }
                                          } catch (e) {
                                            console.error('Failed to refresh question after reorder', e)
                                          }

                                          if (onRefresh) onRefresh()
                                        } catch (err) {
                                          console.error('Failed to update element order', err)
                                        }
                                    }}
                                    sx={{
                                        p: 0.4,
                                        bgcolor: dragOverIndex === idx ? 'rgba(0,0,0,0.04)' : 'transparent',
                                        borderRadius: 1,
                                        mb: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                    }}
                                >
                                    {editing && !readOnly && (
                                        <Box
                                            draggable={!readOnly}
                                            onDragStart={(e) => {
                                                if (readOnly) return
                                                draggingIndexRef.current = idx
                                                try { e.dataTransfer.setData('text/element-index', String(idx)) } catch (ee) {}
                                                e.dataTransfer.effectAllowed = 'move'
                                            }}
                                            onDragEnd={() => { draggingIndexRef.current = null; setDragOverIndex(null) }}
                                            sx={{ mr: 1, display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.secondary' }}
                                        >
                                            <DragIndicatorIcon fontSize="small" />
                                        </Box>
                                    )}
                                    <Box
                                        component="div"
                                        contentEditable={!readOnly}
                                        suppressContentEditableWarning
                                        role={readOnly ? undefined : 'textbox'}
                                        onBlur={(event) => {
                                            const newTitle = event.target.innerText;
                                            setElements(els => els.map(it => (it && it.id) === (el && el.id) ? { ...it, title: newTitle } : it));
                                            if (el.id) saveElement(el.id, { title: newTitle });
                                        }}
                                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.target.blur(); } }}
                                        onPaste={(event) => {
                                            event.preventDefault();
                                            const text = (event.clipboardData || window.clipboardData).getData('text');
                                            document.execCommand ? document.execCommand('insertText', false, text) : (event.target.innerText += text);
                                        }}
                                        sx={{ flex: 1, minWidth: 0, px: 0, py: 0, bgcolor: 'transparent', border: 'none', outline: 'none', '&:focus': { outline: 'none' } }}
                                    >
                                        {el.title}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: '0 0 auto' }}>
                                        <IconButton size="small" onClick={(event) => openElementMenu(event, el)} title="Personnaliser la sous-question" disabled={readOnly}>
                                            <SettingsIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" onClick={() => deleteElement(el.id)} disabled={readOnly}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            ))}                        </Box>
                    </Box>
                )}
            </Stack>

            <Popover
                open={!!customElement && !!customAnchorEl}
                anchorEl={customAnchorEl}
                onClose={closeElementMenu}
                anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
                transformOrigin={{ vertical: 'center', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            width: 260,
                            p: 1.5,
                            ml: 1,
                            display: 'grid',
                            gap: 1.5,
                            borderRadius: 2,
                            border: '1px solid rgba(0,0,0,0.08)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                        },
                    },
                }}
            >
                <FormControl fullWidth size="small">
                    <InputLabel id="element-answer-type-label">Type de question</InputLabel>
                    <Select
                        labelId="element-answer-type-label"
                        label="Type de question"
                        value={customElement ? customElement.type || 'radio' : 'radio'}
                        onChange={(event) => updateCustomElement({ type: event.target.value })}
                    >
                        <MenuItem value="radio">Choix unique</MenuItem>
                        <MenuItem value="checkbox">Choix multiple</MenuItem>
                        <MenuItem value="text">Texte</MenuItem>
                    </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                    <InputLabel id="element-evaluation-type-label">Type de note</InputLabel>
                    <Select
                        labelId="element-evaluation-type-label"
                        label="Type de note"
                        value={noteType}
                        onChange={(event) => {
                            const nextType = Number(event.target.value);
                            updateCustomElement({
                                evaluatingType: nextType,
                                evaluatingValue: (nextType === 0 || nextType === 5) ? 0 : Number(customElement?.evaluatingValue || 0),
                            });
                        }}
                    >
                        <MenuItem value={0}>Non noté</MenuItem>
                        <MenuItem value={1}>Ajoute</MenuItem>
                        <MenuItem value={2}>Enlève</MenuItem>
                        <MenuItem value={3}>Par coefficient</MenuItem>
                        <MenuItem value={5}>Plafond catégorie</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    label={noteType === 3 ? 'Coefficient' : 'Note'}
                    size="small"
                    type="number"
                    disabled={noteValueDisabled}
                    value={noteValueDisabled ? '' : customElement?.evaluatingValue ?? 0}
                    onChange={(event) => {
                        const raw = event.target.value;
                        updateCustomElement({ evaluatingValue: raw === '' ? 0 : parseFloat(raw) });
                    }}
                    inputProps={{ step: 0.1 }}
                    fullWidth
                />
            </Popover>
        </Card>
    );
}

export default QuestionComponent;
