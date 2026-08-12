-- WEBCRM — triggers (v1)
-- Mantém clientes.cliente_status sincronizado, substituindo a fórmula original:
--   =IF(COUNTIFS(urls!B:B,A2,urls!H:H,"ATIVO",urls!G:G,"PROD")>0,"ATIVO","INATIVO")
-- ou seja: cliente fica ATIVO se tiver pelo menos uma URL com url_status='ATIVO'
-- num servidor de ambiente 'PROD'.
--
-- NOTA: url_ambiente (era "urls!G:G" na planilha) não existe como coluna em urls
-- (schema.sql) -- era um VLOOKUP pra servidores.server_ambiente via server_id.
-- Por isso os triggers abaixo fazem JOIN com servidores em vez de ler uma coluna direta.
--
-- Rode depois de schema.sql e views.sql.

-- Recalcula o status de um cliente específico
-- (repetido em cada trigger porque SQLite não tem "funções" reaproveitáveis fora de views)

CREATE TRIGGER trg_urls_ai_cliente_status
AFTER INSERT ON urls
BEGIN
    UPDATE clientes SET cliente_status = (
        CASE WHEN EXISTS (
            SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
            WHERE u.cliente_id = NEW.cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
        ) THEN 'ATIVO' ELSE 'INATIVO' END
    )
    WHERE cliente_id = NEW.cliente_id;
END;

CREATE TRIGGER trg_urls_au_cliente_status
AFTER UPDATE ON urls
BEGIN
    UPDATE clientes SET cliente_status = (
        CASE WHEN EXISTS (
            SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
            WHERE u.cliente_id = NEW.cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
        ) THEN 'ATIVO' ELSE 'INATIVO' END
    )
    WHERE cliente_id = NEW.cliente_id;

    -- se a URL foi reatribuída pra outro cliente, o cliente antigo também precisa recalcular
    UPDATE clientes SET cliente_status = (
        CASE WHEN EXISTS (
            SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
            WHERE u.cliente_id = OLD.cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
        ) THEN 'ATIVO' ELSE 'INATIVO' END
    )
    WHERE cliente_id = OLD.cliente_id AND OLD.cliente_id <> NEW.cliente_id;
END;

CREATE TRIGGER trg_urls_ad_cliente_status
AFTER DELETE ON urls
BEGIN
    UPDATE clientes SET cliente_status = (
        CASE WHEN EXISTS (
            SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
            WHERE u.cliente_id = OLD.cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
        ) THEN 'ATIVO' ELSE 'INATIVO' END
    )
    WHERE cliente_id = OLD.cliente_id;
END;

-- Se um servidor muda de ambiente (ex: DEV -> PROD), todo cliente com URL nesse
-- servidor precisa recalcular -- caso raro, mas necessário pra manter a garantia.
CREATE TRIGGER trg_servidores_au_cliente_status
AFTER UPDATE OF server_ambiente ON servidores
BEGIN
    UPDATE clientes SET cliente_status = (
        CASE WHEN EXISTS (
            SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
            WHERE u.cliente_id = clientes.cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
        ) THEN 'ATIVO' ELSE 'INATIVO' END
    )
    WHERE cliente_id IN (SELECT DISTINCT cliente_id FROM urls WHERE server_id = NEW.server_id);
END;
