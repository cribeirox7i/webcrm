-- WEBCRM — triggers PostgreSQL (Supabase), portado de triggers.sql (SQLite)
-- Mantém clientes.cliente_status e clientes.cliente_dat_bloqueio sincronizados -- cliente fica
-- ATIVO se tiver ao menos uma URL com url_status='ATIVO' num servidor de ambiente 'PROD'; senão
-- fica INATIVO e cliente_dat_bloqueio recebe a data de status (url_dt_status) mais recente entre
-- as URLs desse cliente em servidor 'PROD'.
--
-- Melhoria em relação ao original: o SQLite não tem funções reaproveitáveis fora de views,
-- então a mesma lógica "CASE WHEN EXISTS (...)" era duplicada nos 4 triggers (ver comentário
-- em triggers.sql). Aqui isso vira 1 função compartilhada (recalc_cliente_status) chamada por
-- 4 triggers finos -- elimina a duplicação.
--
-- Rode depois de schema.pg.sql e views.pg.sql.

CREATE OR REPLACE FUNCTION recalc_cliente_status(p_cliente_id INTEGER) RETURNS void AS $$
BEGIN
    UPDATE clientes SET
        cliente_status = (
            CASE WHEN EXISTS (
                SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
                WHERE u.cliente_id = p_cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
            ) THEN 'ATIVO' ELSE 'INATIVO' END
        ),
        cliente_dat_bloqueio = (
            CASE WHEN EXISTS (
                SELECT 1 FROM urls u JOIN servidores s ON s.server_id = u.server_id
                WHERE u.cliente_id = p_cliente_id AND u.url_status = 'ATIVO' AND s.server_ambiente = 'PROD'
            ) THEN NULL ELSE (
                SELECT MAX(u.url_dt_status) FROM urls u JOIN servidores s ON s.server_id = u.server_id
                WHERE u.cliente_id = p_cliente_id AND s.server_ambiente = 'PROD'
            ) END
        )
    WHERE cliente_id = p_cliente_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_urls_ai_cliente_status_fn() RETURNS trigger AS $$
BEGIN
    PERFORM recalc_cliente_status(NEW.cliente_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_urls_ai_cliente_status
AFTER INSERT ON urls
FOR EACH ROW EXECUTE FUNCTION trg_urls_ai_cliente_status_fn();

CREATE OR REPLACE FUNCTION trg_urls_au_cliente_status_fn() RETURNS trigger AS $$
BEGIN
    PERFORM recalc_cliente_status(NEW.cliente_id);
    -- se a URL foi reatribuída pra outro cliente, o cliente antigo também precisa recalcular
    IF OLD.cliente_id <> NEW.cliente_id THEN
        PERFORM recalc_cliente_status(OLD.cliente_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_urls_au_cliente_status
AFTER UPDATE ON urls
FOR EACH ROW EXECUTE FUNCTION trg_urls_au_cliente_status_fn();

CREATE OR REPLACE FUNCTION trg_urls_ad_cliente_status_fn() RETURNS trigger AS $$
BEGIN
    PERFORM recalc_cliente_status(OLD.cliente_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_urls_ad_cliente_status
AFTER DELETE ON urls
FOR EACH ROW EXECUTE FUNCTION trg_urls_ad_cliente_status_fn();

-- Se um servidor muda de ambiente (ex: DEV -> PROD), todo cliente com URL nesse servidor
-- precisa recalcular -- caso raro, mas necessário pra manter a garantia. Precisa de loop
-- (mais de um cliente pode ser afetado por uma única mudança de servidor).
CREATE OR REPLACE FUNCTION trg_servidores_au_cliente_status_fn() RETURNS trigger AS $$
DECLARE
    v_cliente_id INTEGER;
BEGIN
    FOR v_cliente_id IN SELECT DISTINCT cliente_id FROM urls WHERE server_id = NEW.server_id LOOP
        PERFORM recalc_cliente_status(v_cliente_id);
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_servidores_au_cliente_status
AFTER UPDATE OF server_ambiente ON servidores
FOR EACH ROW EXECUTE FUNCTION trg_servidores_au_cliente_status_fn();
