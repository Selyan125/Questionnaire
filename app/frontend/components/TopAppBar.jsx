import React, { useState, useRef, useEffect } from 'react';
import { AppBar, Box, Button, IconButton, Link, Paper, Toolbar, Typography, Popover, TextField } from "@mui/material";
import { LocalizationProvider, StaticDateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

function TopAppBar({ pages = [], selectedPage, onSelectPage, onAddCategory, onRenamePage, title, onTitleChange, date, onDateChange, leftActions, centerActions, rightActions, hideDashboardLink = false }) {
    const [editAnchorEl, setEditAnchorEl] = useState(null);
    const [editIndex, setEditIndex] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [dateInputValue, setDateInputValue] = useState(null);
    const [openTo, setOpenTo] = useState('day');
    const timerRef = useRef(null);
    const longPressTriggeredRef = useRef(false);

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, []);

    useEffect(() => {
        if (date === undefined || date === null) {
            setDateInputValue(null);
            return;
        }
        const parsed = dayjs(date);
        setDateInputValue(parsed.isValid() ? parsed : null);
    }, [date]);

    function formatDate(value) {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function handleDateInputChange(newValue) {
        setDateInputValue(newValue);
    }

    function toggleDateTimeView() {
        setOpenTo((current) => (current === 'day' ? 'hours' : 'day'));
    }

    function openDatePopover(e) {
        setAnchorEl(e.currentTarget);
    }

    function closeDatePopover() {
        setAnchorEl(null);
    }

    function saveDatePopover() {
        if (typeof onDateChange === 'function') {
            const v = dateInputValue;
            if (!v) {
                // nothing
            } else if (v.toISOString) {
                onDateChange(v.toISOString());
            } else {
                const parsed = new Date(v);
                if (!Number.isNaN(parsed.getTime())) onDateChange(parsed.toISOString());
            }
        }
        closeDatePopover();
    }

    function openEdit(anchorEl, index) {
        setEditAnchorEl(anchorEl);
        setEditIndex(index);
        setEditValue((pages && pages[index] && pages[index].name) || '');
        longPressTriggeredRef.current = true;
    }
    function closeEdit() {
        setEditAnchorEl(null);
        setEditIndex(null);
        setEditValue('');
    }
    function startLongPress(e, index) {
        longPressTriggeredRef.current = false;
        const anchor = e.currentTarget;
        timerRef.current = setTimeout(() => openEdit(anchor, index), 600);
    }
    function cancelLongPress() {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }

    return (
        <AppBar
            position="fixed"
            elevation={0}
            sx={{
                backgroundColor: "background.default",
                border: "none",
                borderRadius: 0,
                color: "text.primary",
                m: 0,
                mt: 0,
                top: '6px',
                left: 0,
                right: 0,
                zIndex: (theme) => theme.zIndex.appBar,
            }}
        >
            <Toolbar
                sx={{
                    display: "grid",
                    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                    alignItems: "center",
                    minHeight: "72px !important",
                    px: 2,
                    py: 0,
                    columnGap: 2,
                }}
            >
                <Box sx={{ gridColumn: 1, display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    {leftActions || null}
                     <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0
                        }}
                        >
                        <Box
                            component="div"
                            contentEditable={!!onTitleChange}
                            suppressContentEditableWarning
                            role={onTitleChange ? 'textbox' : undefined}
                            onBlur={onTitleChange ? (event) => onTitleChange(event.target.innerText) : undefined}
                            onKeyDown={onTitleChange ? (event) => { if (event.key === 'Enter') { event.preventDefault(); event.target.blur(); } } : undefined}
                            onPaste={onTitleChange ? (event) => {
                                event.preventDefault();
                                const text = (event.clipboardData || window.clipboardData).getData('text');
                                document.execCommand ? document.execCommand('insertText', false, text) : (event.target.innerText += text);
                            } : undefined}
                            sx={{
                                fontWeight: 500,
                                fontSize: "1.25rem",
                                outline: 'none',
                                width: { xs: 140, sm: 260, md: 320 },
                                maxWidth: { xs: 140, sm: 260, md: 320 },
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: onTitleChange ? 'text' : 'default',
                            }}
                        >
                            {title || 'Questionnaire'}
                        </Box>
                        {onDateChange && (
                            <Typography
                                sx={{
                                    color: 'text.secondary',
                                    fontSize: 14,
                                    cursor: 'pointer', 
                                }}
                                onClick={openDatePopover}
                            >
                                {formatDate(date) || 'Date non définie'}
                            </Typography>
                        )}
                    </Box>
                </Box>
                {onDateChange && ( 
                    <Popover
                        open={!!anchorEl}
                    anchorEl={anchorEl}
                    onClose={() => closeDatePopover()}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{ sx: { p: 2, minWidth: 320 } }}
                >
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <StaticDateTimePicker
                            displayStaticWrapperAs="desktop"
                            value={dateInputValue}
                            onChange={handleDateInputChange}
                            openTo={openTo}
                            ampm={false}
                            slots={{ actionBar: () => null }}
                        />
                    </LocalizationProvider>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Button onClick={() => toggleDateTimeView()} variant="outlined" sx={{ minWidth: 120 }}>Afficher {openTo === 'day' ? 'l’heure' : 'la date'}</Button>
                        <Button onClick={() => saveDatePopover()} variant="text" sx={{ mx: 2, boxShadow: 'none' }}>Enregistrer</Button>
                    </Box>
                    </Popover>
                )}

                <Box sx={{ gridColumn: 2, justifySelf: 'center', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    {pages.length > 0 && (
                        <Paper
                            elevation={0}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            borderRadius: "18px",
                            backgroundColor: "background.paper",
                            boxShadow: "none",
                            border: "1px solid #e5e5e5",
                            width: 'fit-content',
                            maxWidth: '100%',
                            minWidth: 0,
                            overflowX: 'auto',
                            whiteSpace: 'nowrap',
                            scrollbarWidth: 'none',
                            '&::-webkit-scrollbar': { width: 0, height: 0 },
                        }}
                    >
                        {pages.map((page, index) => (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                                <Button
                                    onClick={(e) => { if (longPressTriggeredRef.current) { longPressTriggeredRef.current = false; return; } onSelectPage(index) }}
                                    onMouseDown={(e) => startLongPress(e, index)}
                                    onTouchStart={(e) => startLongPress(e, index)}
                                    onMouseUp={() => cancelLongPress()}
                                    onMouseLeave={() => cancelLongPress()}
                                    onTouchEnd={() => cancelLongPress()}
                                    sx={{
                                        px: 2,
                                        py: 1,
                                        minWidth: 0,
                                        borderRadius: "18px",
                                        textTransform: "none",
                                        fontWeight: 500,
                                        fontSize: "0.95rem",
                                        color: selectedPage === index ? "white" : "#111",
                                        backgroundColor: selectedPage === index ? "#37398f" : "transparent",
                                        "&:hover": {
                                            backgroundColor: selectedPage === index ? "#2f317c" : "#f4f4f4",
                                        },
                                    }}
                                >
                                    {page.name}
                                </Button>

                                {index < pages.length - 1 && (
                                    <Box sx={{ px: 0.5, display: 'flex', alignItems: 'center' }}>
                                        <ChevronRightIcon sx={{ fontSize: '1rem', color: 'rgba(0,0,0,0.45)' }} />
                                    </Box>
                                )}
                            </Box>
                        ))}
                        <Popover
                            open={!!editAnchorEl}
                            anchorEl={editAnchorEl}
                            onClose={() => closeEdit()}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                            PaperProps={{ sx: { p: 1, minWidth: 200 } }}
                        >
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <TextField size="small" value={editValue} onChange={(e) => setEditValue(e.target.value)} fullWidth />
                                <IconButton size="small" onClick={async () => { if (typeof onRenamePage === 'function' && editIndex != null) { await onRenamePage(editIndex, editValue); } closeEdit(); }}>
                                    <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" onClick={() => closeEdit()}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Popover>

                        {/*onAddCategory ? (
                            <IconButton size="small" onClick={() => onAddCategory()} sx={{ ml: 1 }}>
                                <AddIcon />
                            </IconButton>
                        ) : null*/}
                    </Paper>
                    )}
                    {centerActions || null}
                </Box>

                <Box sx={{ gridColumn: 3, justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!hideDashboardLink ? (
                        <Link href="/dashboard" underline="none">
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    mr: 3,
                                    fontWeight: 500,
                                    fontSize: "0.95rem",
                                    color: "text.primary",
                                }}
                            >
                                Tableau de bord
                            </Typography>
                        </Link>
                    ) : null}
                    {rightActions || null}

                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default TopAppBar;
