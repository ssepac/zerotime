const fs = require("fs");
const { capitalizeWord, pluralizeWord } = require("./helper");

const createZerotime = async (connection, table) => {
  connection.connect();

  const describe = (connection, table) => {
    return new Promise((resolve, reject) => {
      const fields = [];
      connection.query(`DESCRIBE ${table};`, (error, results, _fields) => {
        if (error) reject({ error });
        results.forEach((res) => fields.push(res.Field));
        resolve(results);
      });
    });
  };

  const fields = await describe(connection, table);

  const add = (connection, obj) => {
    const cmd = fields
      .reduce((prev, curr, index) => {
        return prev
          .concat(index !== 0 ? "," : "")
          .concat(obj[curr.Field] ? `'${obj[curr.Field]}'` : "NULL");
      }, `INSERT INTO ${table} VALUES (`)
      .concat(");");

    return new Promise((resolve, reject) => {
      connection.query(cmd, (error, results, fields) => {
        if (error) {
          reject({ error });
          console.log(error);
        }
        resolve(results);
      });
    });
  };

  const addFromCsv = (connection, file) => {
    connection.query(
      {
        sql:
          `LOAD DATA LOCAL INFILE '${file}' INTO TABLE pet ` +
          "FIELDS TERMINATED BY ',' " +
          "LINES TERMINATED BY '\n';",
        infileStreamFactory: () => fs.createReadStream(file),
      },
      (error, results, fields) => {
        if (error) throw error;
      }
    );
  };

  /** Generates SQL command from builder methods. */
  const createSqlCommand = (select, where) => {
    const selectCmd =
      select.length === 0
        ? `SELECT * FROM ${table}`
        : select
            .reduce((prev, curr, index) => {
              return prev
                .concat(index !== 0 && index !== select.length - 1 ? ", " : "")
                .concat(` ${select[index]}`);
            }, `SELECT`)
            .concat(` FROM ${table}`);

    return where
      .reduce((prev, curr, index) => {
        return prev
          .concat(index === 0 ? " WHERE" : "")
          .concat(index !== 0 ? " AND" : "")
          .concat(` ${where[index]}`);
      }, selectCmd)
      .concat(";");
  };

  /** Initialize zerotime object,  */
  const zerotime = {
    add,
    addFromCsv: (file) => addFromCsv(connection, file),
    clauses: {
      select: [],
      where: [],
    },
    connection,
    describe: () => describe(connection, table),
    fields: [],
    fieldNames: [],
    find: () => {
      const {
        clauses: { select, where },
      } = zerotime;
      const cmd = createSqlCommand(select, where);

      return new Promise((resolve, reject) => {
        connection.query(cmd, (error, results, fields) => {
          if (error) reject({ error });
          resolve(results);
        });
      });
    },
    kill: () => connection.end(),
    table,
  };

  /** Generate where/get methods dynamically */
  zerotime.fields.push(fields);
  fields.forEach(({ Field: field }) => {
    //generate where
    const whereFunctionName = `where${capitalizeWord(field)}`;
    var whereFunction = (str) => {
      zerotime.clauses.where.push(`${field}='${str}'`);
      return zerotime;
    };
    zerotime[whereFunctionName] = whereFunction;
    zerotime.fieldNames.push(whereFunctionName);

    //generate select
    const selectFunctionName = `get${capitalizeWord(field)}`;
    var selectFunction = () => {
      zerotime.clauses.select.push(field);
      return zerotime;
    };
    zerotime[selectFunctionName] = selectFunction;
    zerotime.fieldNames.push(selectFunctionName);
  });

  return zerotime;
};

module.exports = createZerotime;
