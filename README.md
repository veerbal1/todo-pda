# Todo PDA - Day 4: Becoming a Solana Engineer

**Day 4 (Oct 8): Multiple PDAs per user**

A Solana smart contract built with Anchor Framework that implements a todo list application using Program Derived Addresses (PDAs). This project focuses on PDA derivation with multiple seeds and managing multiple accounts per user.

## 🎯 Learning Goals

- **PDA derivation with multiple seeds**: Understanding how to create unique addresses using composite seeds
- **Account iteration**: Managing multiple related accounts per user
- **Build**: Simple Todo App (create/list todos with PDAs)

## ✨ Features

This is Day 4 of my journey to becoming a Solana Engineer. The project implements a fully functional todo list on-chain with the following features:

- ✅ Initialize user-specific todo counter
- ✅ Create todos with unique PDAs per user
- ✅ Mark todos as complete
- ✅ Update todo titles
- ✅ Delete todos and reclaim rent

## 🏗️ Architecture

### Program Derived Addresses (PDAs)

The program uses two types of PDAs:

1. **Counter PDA**: `[user_pubkey, "counter"]`
   - Tracks the next available todo index
   - Unique per user

2. **Todo PDA**: `[user_pubkey, "todo", index]`
   - Each todo has a unique address derived from user and index
   - Allows multiple todos per user with deterministic addresses

### Account Structures

**TodoCounter**
```rust
pub struct TodoCounter {
    pub next_index: u64,  // Next available index
    pub bump: u8,         // PDA bump seed
}
```

**Todo**
```rust
pub struct Todo {
    pub title: String,        // Max 200 characters
    pub is_completed: bool,   // Completion status
}
```

## 🚀 Getting Started

### Prerequisites

- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.31+
- Node.js 16+

### Installation

```bash
# Install dependencies
npm install

# Build the program
anchor build

# Run tests
anchor test
```

### Deployment

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to localnet
anchor deploy
```

## 📝 Program Instructions

### 1. Initialize Counter
```typescript
await program.methods
  .initialize()
  .accountsPartial({
    counter: counterPDA,
    user: user.publicKey,
  })
  .rpc();
```

### 2. Create Todo
```typescript
await program.methods
  .createTodo("Buy milk")
  .accountsPartial({
    user: user.publicKey,
    counter: counterPDA,
    todo: todoPDA,
  })
  .rpc();
```

### 3. Mark Complete
```typescript
await program.methods
  .markComplete(new BN(todoIndex))
  .accountsPartial({
    user: user.publicKey,
    todo: todoPDA,
  })
  .rpc();
```

### 4. Update Todo
```typescript
await program.methods
  .updateTodo(new BN(todoIndex), "New title")
  .accountsPartial({
    user: user.publicKey,
    todo: todoPDA,
  })
  .rpc();
```

### 5. Delete Todo
```typescript
await program.methods
  .deleteTodo(new BN(todoIndex))
  .accountsPartial({
    user: user.publicKey,
    todo: todoPDA,
  })
  .rpc();
```

## 🧪 Testing

The test suite covers:
- Counter initialization
- Creating multiple todos
- Preventing duplicate initialization
- Marking todos complete
- Updating todo titles
- Deleting todos and rent reclamation
- Creating new todos after deletion

Run tests:
```bash
anchor test
```

## 🔑 Key Concepts Learned

1. **PDA Derivation with Multiple Seeds**: Creating unique addresses using `[user_pubkey, "todo", index]`
2. **Multiple PDAs per User**: Each user can have unlimited todos, each with its own PDA
3. **Account Iteration Pattern**: Using a counter to manage sequential indices for account discovery
4. **Composite Seed Strategy**: Combining static strings with dynamic values (indices) for PDA generation
5. **Account Management**: Using `init` and `close` constraints for lifecycle management
6. **Rent Economics**: Reclaiming rent when closing accounts

## 📂 Project Structure

```
todo-pda/
├── programs/
│   └── todo-pda/
│       └── src/
│           └── lib.rs          # Main program logic
├── tests/
│   └── todo-pda.ts             # Comprehensive test suite
├── Anchor.toml                 # Anchor configuration
└── package.json                # Node dependencies
```

## 🛠️ Technologies Used

- **Anchor Framework** (v0.31): Solana development framework
- **Rust**: Smart contract language
- **TypeScript**: Testing and client code
- **Chai**: Assertion library for tests
- **Mocha**: Test runner

## 📚 Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Program Library](https://spl.solana.com/)

## 🔐 Program ID

```
3KycJfDcJV8gLSeaLMKU8PSNiKGNCsdihiJc64kcVFmJ
```

## 📄 License

ISC

---

**Day 4 Complete** ✅ | Next: Building more complex state management patterns
