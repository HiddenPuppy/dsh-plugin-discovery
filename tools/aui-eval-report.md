# AUI golden-set report

Generated against the 24,075-entry catalog with the default model judge (temperature 0, 800-token budget).

| threshold | hits | wrong | missed | false positives | accuracy | precision | recall |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.5 | 24/26 | 1 | 1 | 0/10 | 94.4% | 96.0% | 92.3% |
| 0.6 | 24/26 | 1 | 1 | 0/10 | 94.4% | 96.0% | 92.3% |
| 0.7 | 22/26 | 0 | 4 | 0/10 | 88.9% | 100.0% | 84.6% |
| 0.8 | 17/26 | 0 | 9 | 0/10 | 75.0% | 100.0% | 65.4% |

## Per case (threshold 0.6)

| id | kind | suggested | plugin | confidence | verdict |
| --- | --- | --- | --- | ---: | --- |
| excel-formula | positive | False | zirscard/dsh-office-audit | 0.58 | missed (quiet) |
| office-ui | positive | True | dake6767/dsh-onlyoffice | 0.62 | hit |
| context-panel | positive | True | bowenliang123/dsh-context | 0.90 | hit |
| better-sidebar | positive | True | tingfeng347/dsh-vscode-workbench | 0.90 | hit |
| worktable | positive | True | Qianrushixiaobai/dsh-agentmonitor | 0.78 | hit |
| browser-op | positive | True | titanwings/dsh-better-browser | 0.87 | hit |
| xhs-collect | positive | True | nataliwhite20534-droid/dsh-xhs-collector | 0.85 | hit |
| xhs-video-watermark | positive | True | hzwym8912-code/dsh-everything-down | 0.82 | hit |
| bili-daily | positive | True | c1overzz/dsh-bili-scroll | 0.96 | hit |
| memory | positive | True | JunNanLYS/dsh-layered-memory | 0.95 | hit |
| lark-bot | positive | True | omdsh-dev/dsh-lark | 0.85 | hit |
| email | positive | True | STARDUSTLC666/dsh-email | 0.94 | hit |
| meeting-minutes | positive | True | scarf1985566475-cloud/dsh-voice | 0.88 | hit |
| tts | positive | True | 1624318455/dsh-plugin-tts | 0.85 | hit |
| voice-input | positive | True | 3274375092/dsh-voice | 0.75 | hit |
| cron | positive | True | GooDAnDReaDY/dsh-cron | 0.82 | hit |
| paper-reader | positive | True | baigaobai/dsh-paper-harness | 0.75 | hit |
| chart | positive | True | lxfu1/dsh-plugin-chart | 0.75 | hit |
| sales-crm | positive | True | pqkisvery666/dsh-basic-office | 0.62 | wrong pick |
| subscriptions | positive | True | V1ki/dsh-plugin-subscriptions | 0.95 | hit |
| usage-cost | positive | True | Han-1413141/dsh-cost-meter | 0.82 | hit |
| pocket-remote | positive | True | mrRisega/dsh-remote | 0.78 | hit |
| pptx | positive | True | rong-coder/dsh-office-tool | 0.62 | hit |
| ocr | positive | True | Anionex/dsh-vision-toolkit | 0.82 | hit |
| emoji | positive | True | hellodigua/dsh-emoji | 0.95 | hit |
| pdf-translate | positive | True | MARIOMLY/dsh-pdf-translate | 0.88 | hit |
| chitchat | negative | False | — | 0.98 | correctly quiet |
| coding | negative | False | — | 0.95 | correctly quiet |
| concept | negative | False | — | 0.98 | correctly quiet |
| poem | negative | False | — | 0.95 | correctly quiet |
| debug | negative | False | — | 0.95 | correctly quiet |
| date | negative | False | — | 0.90 | correctly quiet |
| summarize-chat | negative | False | — | 0.95 | correctly quiet |
| math | negative | False | — | 0.98 | correctly quiet |
| naming | negative | False | — | 0.97 | correctly quiet |
| opinion | negative | False | — | 0.90 | correctly quiet |

`excel-formula` is intentionally just below the default threshold (0.58): the judge proposed `zirscard/dsh-office-audit`, a formula auditor, and stayed quiet rather than risk a wrong popup. Lower `minConfidence` to 0.5 in the AUI settings if you prefer more coverage.

