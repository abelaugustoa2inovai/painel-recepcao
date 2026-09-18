// ================== CONFIGURAÇÕES DO PAINEL ==================
// Edite este arquivo para ajustar o painel. Depois de salvar, o painel
// atualiza sozinho (pode levar alguns minutos / um recarregar da página).

window.PAINEL_CONFIG = {

  // Nome que aparece no topo, ao lado da logo.
  brandName: "Bem-vindo(a)",

  // Cidade do clima (coordenadas de São José do Rio Preto - SP).
  // Para outra cidade, troque a latitude/longitude e o nome.
  weather: {
    city: "São José do Rio Preto",
    lat: -20.8197,
    lon: -49.3794
  },

  // Tempo (em segundos) que cada tela fica na frente antes de trocar.
  slideSeconds: 10,

  // ---- PLANILHA DO GOOGLE (aniversariantes e avisos) ----
  // Cole aqui os links CSV das abas publicadas na web.
  // (No Google Sheets: Arquivo > Compartilhar > Publicar na web >
  //  escolha a aba > formato "Valores separados por vírgula (.csv)".)
  // Enquanto estiver "", o painel usa os arquivos locais
  // birthdays.json e notices.json.
  sheets: {
    birthdaysCsv: "",
    noticesCsv: ""
  }
};
