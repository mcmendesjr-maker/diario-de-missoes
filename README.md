# Diário de Missões

Organizador de rotina gamificado: missões pessoais e profissionais, XP por dificuldade, níveis, sequência de dias, conquistas e grupos com ranking. Login com Google e dados no Firebase.

Acesse: https://mcmendesjr-maker.github.io/diario-de-missoes/

## Arquivos
- `index.html`: estrutura das telas
- `style.css`: visual
- `app.js`: telas, regras de XP, grupos e ranking
- `achievements.js`: catálogo das 83 conquistas
- `look.js`: ícones, cores das tags e animações
- `avatar.js`: peças do avatar em pixel art (grade 32x32)
- `firebase.js`: conexão com login e banco de dados
- `sw.js`: modo offline (a cada atualização, aumente `VERSION` aqui e o `?v=` no index.html e no app.js)
- `manifest.json` e `icons/`: instalação no celular
- `firestore.rules`: regras de segurança (copiar para Firestore → Regras)
