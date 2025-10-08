import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { TodoPda } from "../target/types/todo_pda";
import { expect } from "chai";

describe("todo-pda", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TodoPda as Program<TodoPda>;
  const user = provider.wallet;

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
});
