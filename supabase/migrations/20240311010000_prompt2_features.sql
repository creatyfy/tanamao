/*
  # Correção da Migração de Avaliações
  
  A tabela 'reviews' já existe no banco de dados com a estrutura correta 
  (reviewer_id, target_type, target_id, rating) e as políticas RLS já estão configuradas.
  
  Portanto, esta migração foi ajustada para não executar nenhuma alteração estrutural,
  evitando o erro de coluna inexistente (client_id).
*/

-- Nenhuma alteração estrutural é necessária. O banco já está pronto!
