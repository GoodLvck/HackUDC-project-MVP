BASE_MODEL="${BASE_MODEL:-llama3.2}"

curl http://localhost:11434/api/pull -d "{
  \"model\": \"${BASE_MODEL}\"
}"
