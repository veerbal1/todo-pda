import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { TodoPda } from "../target/types/todo_pda";
import { expect } from "chai";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("todo-pda", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TodoPda as Program<TodoPda>;
  const user = provider.wallet;
  const connection = provider.connection;

  const getCounterPDA = () => {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [user.publicKey.toBuffer(), Buffer.from("counter")],
      program.programId
    );
  };

  const getTodoPDA = (index: number) => {
    const indexBuffer = Buffer.alloc(8);
    indexBuffer.writeBigUInt64LE(BigInt(index));

    return anchor.web3.PublicKey.findProgramAddressSync(
      [user.publicKey.toBuffer(), Buffer.from("todo"), indexBuffer],
      program.programId
    );
  };

  it("Is initialized!", async () => {
    const [counterPDA] = getCounterPDA();

    await program.methods
      .initialize()
      .accountsPartial({
        counter: counterPDA,
        user: user.publicKey,
      })
      .rpc();

    const counter = await program.account.todoCounter.fetch(counterPDA);
    expect(counter.nextIndex.toNumber()).to.equal(0);
  });

  it("Creates first todo", async () => {
    const [counterPDA] = getCounterPDA();
    const [todoPDA] = getTodoPDA(0);

    await program.methods
      .createTodo("Buy milk")
      .accountsPartial({
        user: user.publicKey,
        counter: counterPDA,
        todo: todoPDA,
      })
      .rpc();

    // Verify todo data
    const todo = await program.account.todo.fetch(todoPDA);
    expect(todo.title).to.equal("Buy milk");
    expect(todo.isCompleted).to.be.false;

    // Verify counter incremented
    const counter = await program.account.todoCounter.fetch(counterPDA);
    expect(counter.nextIndex.toNumber()).to.equal(1);
  });

  it("Fails when trying to initialize counter twice", async () => {
    const [counterPDA] = getCounterPDA();

    try {
      await program.methods
        .initialize()
        .accountsPartial({
          counter: counterPDA,
          user: user.publicKey,
        })
        .rpc();

      expect.fail("Should have thrown an error");
    } catch (err) {
      expect(err.message).to.include("already in use");
    }
  });

  it("Creates multiple todos", async () => {
    const [counterPDA] = getCounterPDA();
    const [todoPDA1] = getTodoPDA(1);
    const [todoPDA2] = getTodoPDA(2);

    // Create second todo
    await program.methods
      .createTodo("Write code")
      .accountsPartial({
        user: user.publicKey,
        counter: counterPDA,
        todo: todoPDA1,
      })
      .rpc();

    // Create third todo
    await program.methods
      .createTodo("Deploy app")
      .accountsPartial({
        user: user.publicKey,
        counter: counterPDA,
        todo: todoPDA2,
      })
      .rpc();

    // Verify todos
    const todo1 = await program.account.todo.fetch(todoPDA1);
    expect(todo1.title).to.equal("Write code");
    expect(todo1.isCompleted).to.be.false;

    const todo2 = await program.account.todo.fetch(todoPDA2);
    expect(todo2.title).to.equal("Deploy app");
    expect(todo2.isCompleted).to.be.false;

    // Verify counter incremented to 3
    const counter = await program.account.todoCounter.fetch(counterPDA);
    expect(counter.nextIndex.toNumber()).to.equal(3);
  });

  it("Marks a todo as complete", async () => {
    const [todoPDA] = getTodoPDA(0);

    // Mark first todo as complete
    await program.methods
      .markComplete(new BN(0))
      .accountsPartial({
        user: user.publicKey,
        todo: todoPDA,
      })
      .rpc();

    // Verify todo is marked complete
    const todo = await program.account.todo.fetch(todoPDA);
    expect(todo.isCompleted).to.be.true;
    expect(todo.title).to.equal("Buy milk"); // Title should remain unchanged
  });

  it("Updates a todo title", async () => {
    const [todoPDA] = getTodoPDA(1);

    // Update second todo
    await program.methods
      .updateTodo(new BN(1), "Write better code")
      .accountsPartial({
        user: user.publicKey,
        todo: todoPDA,
      })
      .rpc();

    // Verify todo title is updated
    const todo = await program.account.todo.fetch(todoPDA);
    expect(todo.title).to.equal("Write better code");
    expect(todo.isCompleted).to.be.false; // Should still be incomplete
  });

  it("Deletes a todo and returns rent", async () => {
    const [todoPDA] = getTodoPDA(2);

    // Get user balance before deletion
    const userBalanceBefore = await provider.connection.getBalance(
      user.publicKey
    );

    // Delete third todo
    await program.methods
      .deleteTodo(new BN(2))
      .accountsPartial({
        user: user.publicKey,
        todo: todoPDA,
      })
      .rpc();

    // Verify todo account no longer exists
    try {
      await program.account.todo.fetch(todoPDA);
      expect.fail("Todo should have been deleted");
    } catch (err) {
      expect(err.message).to.include("Account does not exist");
    }

    // Verify user received rent back
    const userBalanceAfter = await provider.connection.getBalance(
      user.publicKey
    );
    expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore);
  });

  it("Can create a new todo after deletion with same index", async () => {
    const [counterPDA] = getCounterPDA();
    const [todoPDA] = getTodoPDA(3);

    // Create a new todo (index should be 3)
    await program.methods
      .createTodo("New task")
      .accountsPartial({
        user: user.publicKey,
        counter: counterPDA,
        todo: todoPDA,
      })
      .rpc();

    // Verify the new todo
    const todo = await program.account.todo.fetch(todoPDA);
    expect(todo.title).to.equal("New task");
    expect(todo.isCompleted).to.be.false;

    // Verify counter incremented
    const counter = await program.account.todoCounter.fetch(counterPDA);
    expect(counter.nextIndex.toNumber()).to.equal(4);
  });

  describe("Input Validation Tests", () => {
    it("Fails to create todo with empty title", async () => {
      const [counterPDA] = getCounterPDA();
      const [todoPDA] = getTodoPDA(4);

      try {
        await program.methods
          .createTodo("")
          .accountsPartial({
            user: user.publicKey,
            counter: counterPDA,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for empty title");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Title can't be empty");
        expect(err.error.errorCode.code).to.equal("TitleEmpty");
      }
    });

    it("Fails to create todo with whitespace-only title", async () => {
      const [counterPDA] = getCounterPDA();
      const [todoPDA] = getTodoPDA(4);

      try {
        await program.methods
          .createTodo("   ")
          .accountsPartial({
            user: user.publicKey,
            counter: counterPDA,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for whitespace-only title");
      } catch (err) {
        expect(err.error.errorMessage).to.equal(
          "Title cannot be only whitespace"
        );
        expect(err.error.errorCode.code).to.equal("TitleWhitespaceOnly");
      }
    });

    it("Fails to create todo with title too short (< 3 chars)", async () => {
      const [counterPDA] = getCounterPDA();
      const [todoPDA] = getTodoPDA(4);

      try {
        await program.methods
          .createTodo("ab")
          .accountsPartial({
            user: user.publicKey,
            counter: counterPDA,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for title too short");
      } catch (err) {
        expect(err.error.errorMessage).to.equal(
          "Title should have minimum 3 length"
        );
        expect(err.error.errorCode.code).to.equal("TitleTooShort");
      }
    });

    it("Fails to create todo with title too long (> 200 chars)", async () => {
      const [counterPDA] = getCounterPDA();
      const [todoPDA] = getTodoPDA(4);

      const longTitle = "a".repeat(201);

      try {
        await program.methods
          .createTodo(longTitle)
          .accountsPartial({
            user: user.publicKey,
            counter: counterPDA,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for title too long");
      } catch (err) {
        expect(err.error.errorMessage).to.equal(
          "Title can't be greater then 200 chars"
        );
        expect(err.error.errorCode.code).to.equal("TitleTooLong");
      }
    });

    it("Successfully creates todo with exactly 3 characters", async () => {
      const [counterPDA] = getCounterPDA();
      const [todoPDA] = getTodoPDA(4);

      await program.methods
        .createTodo("abc")
        .accountsPartial({
          user: user.publicKey,
          counter: counterPDA,
          todo: todoPDA,
        })
        .rpc();

      const todo = await program.account.todo.fetch(todoPDA);
      expect(todo.title).to.equal("abc");
      expect(todo.isCompleted).to.be.false;

      const counter = await program.account.todoCounter.fetch(counterPDA);
      expect(counter.nextIndex.toNumber()).to.equal(5);
    });

    it("Successfully creates todo with exactly 200 characters", async () => {
      const [counterPDA] = getCounterPDA();
      const [todoPDA] = getTodoPDA(5);

      const maxLengthTitle = "a".repeat(200);

      await program.methods
        .createTodo(maxLengthTitle)
        .accountsPartial({
          user: user.publicKey,
          counter: counterPDA,
          todo: todoPDA,
        })
        .rpc();

      const todo = await program.account.todo.fetch(todoPDA);
      expect(todo.title).to.equal(maxLengthTitle);
      expect(todo.isCompleted).to.be.false;

      const counter = await program.account.todoCounter.fetch(counterPDA);
      expect(counter.nextIndex.toNumber()).to.equal(6);
    });

    it("Fails to update todo with empty title", async () => {
      const [todoPDA] = getTodoPDA(4);

      try {
        await program.methods
          .updateTodo(new BN(4), "")
          .accountsPartial({
            user: user.publicKey,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for empty title");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Title can't be empty");
        expect(err.error.errorCode.code).to.equal("TitleEmpty");
      }
    });

    it("Fails to update todo with whitespace-only title", async () => {
      const [todoPDA] = getTodoPDA(4);

      try {
        await program.methods
          .updateTodo(new BN(4), "\t\n  ")
          .accountsPartial({
            user: user.publicKey,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for whitespace-only title");
      } catch (err) {
        expect(err.error.errorMessage).to.equal(
          "Title cannot be only whitespace"
        );
        expect(err.error.errorCode.code).to.equal("TitleWhitespaceOnly");
      }
    });

    it("Fails to update todo with title too short", async () => {
      const [todoPDA] = getTodoPDA(4);

      try {
        await program.methods
          .updateTodo(new BN(4), "xy")
          .accountsPartial({
            user: user.publicKey,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for title too short");
      } catch (err) {
        expect(err.error.errorMessage).to.equal(
          "Title should have minimum 3 length"
        );
        expect(err.error.errorCode.code).to.equal("TitleTooShort");
      }
    });

    it("Fails to update todo with title too long", async () => {
      const [todoPDA] = getTodoPDA(4);

      const longTitle = "b".repeat(201);

      try {
        await program.methods
          .updateTodo(new BN(4), longTitle)
          .accountsPartial({
            user: user.publicKey,
            todo: todoPDA,
          })
          .rpc();

        expect.fail("Should have thrown an error for title too long");
      } catch (err) {
        expect(err.error.errorMessage).to.equal(
          "Title can't be greater then 200 chars"
        );
        expect(err.error.errorCode.code).to.equal("TitleTooLong");
      }
    });

    it("Successfully updates todo with valid title", async () => {
      const [todoPDA] = getTodoPDA(4);

      await program.methods
        .updateTodo(new BN(4), "Updated title")
        .accountsPartial({
          user: user.publicKey,
          todo: todoPDA,
        })
        .rpc();

      const todo = await program.account.todo.fetch(todoPDA);
      expect(todo.title).to.equal("Updated title");
    });
  });

  describe("Data fetching tests", () => {
    it("Fetches all todos for a user", async () => {
      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // user field starts at byte 8
              bytes: user.publicKey.toBase58(),
            },
          },
        ],
      });

      console.log("Total todos for user:", accounts.length);
      expect(accounts.length).to.equal(5); // We have 5 todos (index 0, 1, 3, 4, 5)
    });

    it("Fetches only incomplete todos", async () => {
      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // user field
              bytes: user.publicKey.toBase58(),
            },
          },
          {
            memcmp: {
              offset: 40, // is_completed field is at byte 40
              bytes: bs58.encode([0]), // 0 = false (incomplete)
            },
          },
        ],
      });

      console.log("Incomplete todos:", accounts.length);
      expect(accounts.length).to.equal(4); // Todos at index 1, 3, 4, 5 are incomplete
    });

    it("Fetches only completed todos", async () => {
      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // user field
              bytes: user.publicKey.toBase58(),
            },
          },
          {
            memcmp: {
              offset: 40, // is_completed field
              bytes: bs58.encode([1]), // 1 = true (completed)
            },
          },
        ],
      });

      console.log("Completed todos:", accounts.length);
      expect(accounts.length).to.equal(1); // Only todo at index 0 is completed

      // Verify it's the right todo
      const todo = await program.account.todo.fetch(accounts[0].pubkey);
      expect(todo.isCompleted).to.be.true;
      expect(todo.title).to.equal("Buy milk");
    });

    it("Fetches all program accounts (todos + counter)", async () => {
      const accounts = await connection.getProgramAccounts(program.programId);

      console.log("Total program accounts:", accounts.length);
      expect(accounts.length).to.equal(6); // 5 todos + 1 counter
    });

    it("Manually decodes and displays all todos", async () => {
      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 8,
              bytes: user.publicKey.toBase58(),
            },
          },
        ],
      });

      console.log("\n=== All User Todos ===");
      for (const account of accounts) {
        const todo = await program.account.todo.fetch(account.pubkey);
        console.log(`Title: ${todo.title}, Completed: ${todo.isCompleted}`);
      }

      expect(accounts.length).to.equal(5);
    });
  });
});
