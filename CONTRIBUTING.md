# Guia de Contribuição e Arquitetura

Obrigado por contribuir com o **DynamicFront**! 🚀

Este projeto difere da maioria porque é uma **Arquitetura "Shell" Agnística**. Ele não é um ERP, nem um LMS, nem um CRM. Ele é uma plataforma que se *torna* qualquer um desses sistemas dependendo dos recursos conectados.

## 🚨 Regra de Ouro: ZERO DOMAIN BIAS

Ao contribuir, você deve garantir que seu código não contenha "conhecimento prévio" sobre o negócio do usuário final.

### O Teste do Hospital
Antes de submeter um PR, faça o "Teste do Hospital":
> "Se eu conectar uma API de Hospital neste sistema agora, meu código vai:
> 1. Quebrar?
> 2. Mostrar termos estranhos (ex: 'Alunos encontradas' em vez de 'Pacientes encontrados')?
> 3. Tentar fazer lógica de 'Matrícula'?"

Se a resposta for SIM para qualquer uma, **seu código está enviesado**. Reescreva.

---

## 🏗️ Padrões de Código Genérico

### 1. Frontend (Generative UI)
Nunca crie componentes visuais específicos de domínio.

- **❌ Errado**: `client/src/components/CourseList.jsx`
- **✅ Correto**: `client/src/gen-ui/components/DataTable.jsx`

Os componentes devem ser primitivos visuais (Cards, Tables, Lists, KeyValuePairs) que o Agente "Designer" compõe dinamicamente.

### 2. Backend (Agents & Services)
Nunca assuma nomes de ferramentas ou parâmetros.

- **❌ Errado**:
```javascript
// Executor.js
if (tool.name === 'enroll_student') {
    // Lógica especial de matrícula
}
```

- **✅ Correto**:
```javascript
// Executor.js
// Verifica se a ferramenta altera estado baseado em metadata
if (tool.httpMethod === 'POST') {
    // Lógica genérica de confirmação
}
```

### 3. Prompts e LLMs
Os System Prompts dos agentes não devem mencionar o domínio atual (ex: SENAI, Educação).
O domínio deve ser injetado via **Contexto Dinâmico** no momento da execução.

---

## 📝 Documentação
- Todo código novo deve ser documentado.
- Se criar uma nova Tool ou Helper, explique como ela se comporta em diferentes contextos (ex: "Funciona para listas de Produtos E listas de Pacientes").

## ✅ Pull Request Checklist
1. O código funciona sem hardcoding?
2. Os testes passam?
3. O "Teste do Hospital" foi aprovado?

---

**Mantenha o sistema líquido. Mantenha o sistema dinâmico.**
