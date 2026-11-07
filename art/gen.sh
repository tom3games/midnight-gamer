#!/bin/zsh
# 切り絵の人物シート（緑背景）を作る。zsh art/gen.sh
cd ~/Desktop/claudecode/midnight-gamer/art
G=~/.claude/skills/3d-homepage/scripts/codex_imagegen.py
python3 $G raw/mom_a.png prompts/mom_a.md ref/mom_normal.webp --quality high --size 1536x1024 > logs/mom_a.log 2>&1 &
python3 $G raw/mom_b.png prompts/mom_b.md ref/mom_normal.webp --quality high --size 1536x1024 > logs/mom_b.log 2>&1 &
python3 $G raw/dad_a.png prompts/dad_a.md ref/dad_walk.webp --quality high --size 1536x1024 > logs/dad_a.log 2>&1 &
python3 $G raw/kid_a.png prompts/kid_a.md ref/mom_normal.webp --quality high --size 1536x1024 > logs/kid_a.log 2>&1 &
python3 $G raw/hands_a.png prompts/hands_a.md ref/mom_normal.webp --quality high --size 1536x1024 > logs/hands_a.log 2>&1 &
wait
ls -la raw
