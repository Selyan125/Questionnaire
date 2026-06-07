import { Paper, Typography, Box, Stack, Divider } from "@mui/material";
import TimerIcon from '@mui/icons-material/Timer';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import StarsIcon from '@mui/icons-material/Stars';

/**
 * Modern Session Info Menu (formerly StudentsMenu)
 * Redesigned to be a sleek information panel instead of a simple list.
 */
export default function StudentsMenu(){
    return (
        <Paper
            elevation={0}
            sx={{
                width: 300,
                height: "calc(100% - 64px)",
                minHeight: 0,
                borderRadius: "32px",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
                p: 3,
                ml: 4,
                my: 4,
                background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,249,253,0.9) 100%)",
                backdropFilter: "blur(20px)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 3
            }}
        >
            <Box>
                <Typography
                    sx={{
                        fontWeight: 900,
                        fontSize: "1.4rem",
                        background: "linear-gradient(45deg, #37398f, #6366f1)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        mb: 0.5
                    }}
                >
                    Session Active
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', fontWeight: 500 }}>
                    Vue d'ensemble et contrôle
                </Typography>
            </Box>

            <Divider sx={{ opacity: 0.6 }} />

            <Stack
                spacing={2.5}
                sx={{ flex: 1 }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'rgba(55, 57, 143, 0.1)', color: '#37398f' }}>
                        <TimerIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase' }}>Temps Restant</Typography>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>45 minutes</Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                        <AssignmentIndIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase' }}>Type de Session</Typography>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>Oral Individuel</Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        <StarsIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase' }}>Statut</Typography>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>En cours d'évaluation</Typography>
                    </Box>
                </Box>
            </Stack>

            <Box sx={{ mt: 'auto', p: 2, borderRadius: '20px', bgcolor: 'rgba(55, 57, 143, 0.05)', border: '1px dashed rgba(55, 57, 143, 0.2)' }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#37398f', textAlign: 'center', fontStyle: 'italic' }}>
                    "Le design est l'ambassadeur silencieux de votre marque."
                </Typography>
            </Box>
        </Paper>
    );
}