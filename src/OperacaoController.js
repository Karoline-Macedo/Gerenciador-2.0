async function connect() {
  if (global.connection && global.connection.state !== 'disconnected')
      return global.connection;
  const mysql = require("mysql2/promise");
  const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: 'root',
      database: 'testeagro'
  });

  console.log("Conectou no MySQL!");
  global.connection = connection;
  return connection;
};

exports.insertFuncionario_operacao = async (req, res, next) => {
  const conn = await connect();

  try {
      await conn.beginTransaction();

      const atividades = req.body.atividades;

      for (const atividade of atividades) {
          const sqlAtividade = `
              INSERT INTO cad_funcionario_atividade (idfuncionario, idatividade, idfazenda)
              VALUES (?, ?, ?)`;
          const valuesAtividade = [
              req.body.idfuncionario,
              atividade.idatividade,
              req.body.idfazenda
          ];
          const [resultAtividade] = await conn.query(sqlAtividade, valuesAtividade);

          if (resultAtividade.affectedRows === 0) {
              await conn.rollback();
              return res.status(500).send('Erro ao inserir atividade do funcionário.');
          };

          const idFuncAtividade = resultAtividade.insertId;

          let idStatus;
          if (atividade.idatividade === 1) {
              idStatus = atividade.idStatusControleEstoque;
          } else if (atividade.idatividade === 2) {
              idStatus = atividade.idStatusCadernoPonto;
          } else if (atividade.idatividade === 3) {
              idStatus = atividade.idStatusRastreamento;
          } else {
              await conn.rollback();
              return res.status(500).send('Atividade desconhecida.');
          };

          const sqlStatus = `
              INSERT INTO cad_status_func_atividade (idstatus, idfunc_ativ_faz)
              VALUES (?, ?)`;
          const valuesStatus = [idStatus, idFuncAtividade];
          const [resultStatus] = await conn.query(sqlStatus, valuesStatus);

          if (resultStatus.affectedRows === 0) {
              await conn.rollback();
              return res.status(500).send('Erro ao inserir status da atividade.');
          };
      };

      await conn.commit();
      res.status(201).send('Dados do funcionário inseridos com sucesso!');
  } catch (error) {
      await conn.rollback();
      res.status(500).send(error.message);
  }
};

exports.updateFuncionario_operacao = async (req, res, next) => {

  const conn = await connect();

  try {
      await conn.beginTransaction();

      let atividades = req.body.atividades;
      let idFazenda = req.body.idfazenda;

      for (let atividade of atividades) {
          let idStatus;
          if (atividade.idatividade === 1) {
              idStatus = atividade.idStatusControleEstoque;
          } else if (atividade.idatividade === 2) {
              idStatus = atividade.idStatusCadernoPonto;
          } else if (atividade.idatividade === 3) {
              idStatus = atividade.idStatusRastreamento;
          } else {
              await conn.rollback();
              return res.status(500).send('Atividade desconhecida.');
          };

          let sqlUpdateStatus = `
              UPDATE cad_status_func_atividade
              SET idstatus = ?
              WHERE idfunc_ativ_faz = (
                    SELECT idfunc_atividade 
                    FROM cad_funcionario_atividade 
                    WHERE idfuncionario = ? 
                    AND idatividade = ? 
                    AND idfazenda = ? 
                    AND data_desativacao is null
                )`;
          let valuesUpdateStatus = [idStatus, req.body.idfuncionario, atividade.idatividade, idFazenda];
          let [resultUpdateStatus] = await conn.query(sqlUpdateStatus, valuesUpdateStatus);

          if (resultUpdateStatus.affectedRows === 0) {
              await conn.rollback();
              return res.status(500).send('Erro ao atualizar status da atividade.');
          };
      };

      await conn.commit();
      res.status(200).send('Status das atividades do funcionário atualizados com sucesso!');
  } catch (error) {
      await conn.rollback();
      res.status(500).send(error.message);
  }
};

exports.get = async (req, res, next) => {

  const conn = await connect();

  const sql = "SELECT"
              +"   cfa.idfuncionario,"
              +"   cf.nome_func,"
              +"   co.descricao as operacao,"
              +"   JSON_ARRAYAGG("
              +"       JSON_OBJECT(" 
              +"           'idatividade', cfa.idatividade, "
              +"           'atividade', ca.descricao, "
              +"           'idfazenda', cfa.idfazenda, "
              +"           'nome_fazenda', cfz.nome_fazenda, " 
              +"            'idstatus', csfa.idstatus, "
              +"            'status', cs.descricao" 
              +"        )"
              +"    ) AS atividades " 
              +"FROM"
              +"    cad_funcionario_atividade cfa "
              +"INNER JOIN"
              +"    cad_atividade ca ON ca.idatividade = cfa.idatividade "
              +"INNER JOIN"
              +"    cad_funcionario cf ON cf.idfuncionario = cfa.idfuncionario "
              +"INNER JOIN"
              +"    cad_fazenda cfz ON cfz.idfazenda = cfa.idfazenda "
              +"INNER JOIN"
              +"    cad_status_func_atividade csfa ON csfa.idfunc_ativ_faz = cfa.idfunc_atividade "
              +"INNER JOIN"
              +"    cad_status cs ON cs.idstatus = csfa.idstatus "
              +" inner join"
              +"    cad_atividade_operacao cao on cao.idatividade = cfa.idatividade "
              +"inner join "
              +"    cad_operacoes co on co.idoperacao = cao.idoperacao "
              +"where "
              +"     co.descricao like '%operacional%' and cfa.data_desativacao is null "
              +"GROUP BY"
              +"    cf.idfuncionario, cf.nome_func,co.descricao "
              +"ORDER BY"
              +"    cf.nome_func";

  const [rows] = await conn.query(sql);
  res.status(200).send(rows);
};

exports.deleteFuncionario_operacao = async (req, res, next) => {
  let id = req.params.id;
  const conn = await connect();

  const sqlDelete = "UPDATE cad_funcionario_atividade SET data_desativacao = now() WHERE idfuncionario = ? and data_desativacao is null";
  const valuesDelete = [id];
  await conn.query(sqlDelete, valuesDelete);

  res.status(200).send('Dado deletado com sucesso!');
};