// ============================================================
//  CONFIGURAÇÃO DO APP — este é o único arquivo que você edita
// ============================================================
// Deixe API_URL vazio para testar em MODO DEMONSTRAÇÃO
// (os dados ficam só no celular, nada é enviado).
var CONFIG = {
  // URL do Web App do Apps Script (termina em /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbyejibIR1qYs9N6xMRL3XjzUOUWIml2N4EURRtJZu1lYgpq2Q7NV5Myfge9YKqzVEoE/exec',

  // Chave gerada pela função setup() — aba Config da planilha, linha API_KEY
  API_KEY: '0c017aa0117d45de809f5f5772b91596',

  // Texto gravado na etiqueta do crachá antes da matrícula.
  // Ex.: crachá do código 1042 recebe o texto  UAM-MEC:1042
  TAG_PREFIXO_MECANICO: 'UAM-MEC:',

  // Depois de quantos minutos parado o app volta a pedir o crachá
  MINUTOS_SESSAO: 30
};
