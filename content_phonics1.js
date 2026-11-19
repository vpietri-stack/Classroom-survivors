TEACHING_CONTENT.Phonics1 = { '1': { 4: { vocab: [], sentences: [], sentencePairs: [] } }, '2': {} };
for (const config of Object.values(PhonicsContent.pages)) {
  TEACHING_CONTENT.Phonics1[config.unit][config.page] = { vocab: config.words.slice(), sentences: [], sentencePairs: [] };
}
AVAILABLE_CONTENT.Phonics1 = { '1': [1, 2, 3, 4], '2': [5] };
