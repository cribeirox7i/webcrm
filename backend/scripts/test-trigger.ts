import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cliente = await client.query("INSERT INTO clientes (cliente_nome) VALUES ('Teste Trigger') RETURNING cliente_id");
  const clienteId = cliente.rows[0].cliente_id;
  const servidor = await client.query("INSERT INTO servidores (server_nome, server_ambiente) VALUES ('srv-teste', 'PROD') RETURNING server_id");
  const serverId = servidor.rows[0].server_id;
  const produto = await client.query("INSERT INTO produtos (produto_nome) VALUES ('Produto Teste') RETURNING produto_id");
  const produtoId = produto.rows[0].produto_id;

  let status = await client.query("SELECT cliente_status FROM clientes WHERE cliente_id = $1", [clienteId]);
  console.log("status antes de qualquer url:", status.rows[0].cliente_status);

  await client.query(
    "INSERT INTO urls (cliente_id, url_path, server_id, produto_id, url_status) VALUES ($1, '/teste', $2, $3, 'ATIVO')",
    [clienteId, serverId, produtoId]
  );
  status = await client.query("SELECT cliente_status FROM clientes WHERE cliente_id = $1", [clienteId]);
  console.log("status depois de url ATIVO em servidor PROD (esperado ATIVO):", status.rows[0].cliente_status);

  await client.query("UPDATE servidores SET server_ambiente = 'DEV' WHERE server_id = $1", [serverId]);
  status = await client.query("SELECT cliente_status FROM clientes WHERE cliente_id = $1", [clienteId]);
  console.log("status depois de servidor virar DEV (esperado INATIVO):", status.rows[0].cliente_status);

  // limpeza
  await client.query("DELETE FROM urls WHERE cliente_id = $1", [clienteId]);
  await client.query("DELETE FROM produtos WHERE produto_id = $1", [produtoId]);
  await client.query("DELETE FROM servidores WHERE server_id = $1", [serverId]);
  await client.query("DELETE FROM clientes WHERE cliente_id = $1", [clienteId]);

  // sanity das colunas geradas
  const pessoa = await client.query(
    "INSERT INTO pessoas (pessoa_nome, pessoa_funcao, pessoa_fone) VALUES ('Fulano', 'Gerente Comercial', '(11) 98888-7777') RETURNING pessoa_grupo, pessoa_whatsapp, pessoa_id"
  );
  console.log("pessoa_grupo (esperado 'G'):", pessoa.rows[0].pessoa_grupo);
  console.log("pessoa_whatsapp (esperado wa.me/1198888-7777... sem pontuação):", pessoa.rows[0].pessoa_whatsapp);
  await client.query("DELETE FROM pessoas WHERE pessoa_id = $1", [pessoa.rows[0].pessoa_id]);

  const cart = await client.query(
    "INSERT INTO cart_mes (cart_ano_mes) VALUES ('2026/08') RETURNING cart_mes_id"
  );
  const cliente2 = await client.query("INSERT INTO clientes (cliente_nome) VALUES ('Teste Carteira') RETURNING cliente_id");
  const carteira = await client.query(
    "INSERT INTO carteira (cliente_id, cart_mes_id, cart_db, cart_data_base) VALUES ($1, $2, 'WEBCRED', '2026-08-15') RETURNING cart_nome_plan_analitica",
    [cliente2.rows[0].cliente_id, cart.rows[0].cart_mes_id]
  );
  console.log("cart_nome_plan_analitica (esperado WEBCRED_Medicao_2026-08-01_2026-08-15.xlsx):", carteira.rows[0].cart_nome_plan_analitica);
  await client.query("DELETE FROM carteira WHERE cliente_id = $1", [cliente2.rows[0].cliente_id]);
  await client.query("DELETE FROM clientes WHERE cliente_id = $1", [cliente2.rows[0].cliente_id]);
  await client.query("DELETE FROM cart_mes WHERE cart_mes_id = $1", [cart.rows[0].cart_mes_id]);

  await client.end();
}

main().catch((err) => {
  console.error("[test] ERRO:", err.message);
  process.exit(1);
});
