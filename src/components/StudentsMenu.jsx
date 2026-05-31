import {Button, Paper, Stack, Typography} from "@mui/material";
import {useState} from "react";

export default function StudentsMenu(){
    const candidates = [
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",
        "Selyan Mohammedi",


    ];
    const [selectedStudent, setSelectedStudent] = useState(0);

    return (
        <Paper
            elevation={0}
            sx={{
                width: 160,
                height: "calc(100% - 16px)",
                minHeight: 0,
                borderRadius: "18px",
                border: "1px solid #d9d9d9",
                p: 2,
                ml: 3,
                marginBottom: '16px',
                backgroundColor: "white",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Typography
                sx={{
                    textAlign: "center",
                    fontWeight: 600,
                    mb: 2,
                    flexShrink: 0,
                }}
            >
                Candidats
            </Typography>

            <Stack
                spacing={0.5}
                sx={{
                    overflowY: "auto",
                    flex: 1,
                    minHeight: 0,

                    scrollbarWidth: "thin", // Firefox
                    scrollbarColor: "#c1c1c1 transparent",

                    "&::-webkit-scrollbar": {
                        width: "6px",
                    },

                    "&::-webkit-scrollbar-track": {
                        background: "transparent",
                    },

                    "&::-webkit-scrollbar-thumb": {
                        backgroundColor: "#c1c1c1",
                        borderRadius: "999px",
                    },

                    "&::-webkit-scrollbar-thumb:hover": {
                        backgroundColor: "#a8a8a8",
                    },
                }}
            >
                {candidates.map((candidate, index) => {
                    const selected = selectedStudent === index;

                    return (
                        <Button
                            key={index}
                            onClick={() => setSelectedStudent(index)}
                            fullWidth
                            variant="contained"
                            sx={{
                                minHeight: selected ? 60 : 40,
                                borderRadius: "12px",
                                textTransform: "none",
                                fontSize: "13px",
                                fontWeight: 600,
                                lineHeight: 1.2,
                                boxShadow: "none",
                                backgroundColor: selected
                                    ? "#373b97"
                                    : "#f4f4f4",
                                color: selected ? "white" : "black",
                                '&:hover': {
                                    backgroundColor: selected
                                        ? "#2f3385"
                                        : "#ececec",
                                    boxShadow: "none",
                                },
                            }}
                        >
                            {candidate}
                        </Button>
                    );
                })}
            </Stack>
        </Paper>

    );
}