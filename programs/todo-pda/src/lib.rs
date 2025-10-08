use anchor_lang::prelude::*;

declare_id!("3KycJfDcJV8gLSeaLMKU8PSNiKGNCsdihiJc64kcVFmJ");

#[program]
pub mod todo_pda {
    use super::*;

    pub fn initialize(ctx: Context<InitializeCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.next_index = 0;
        counter.bump = ctx.bumps.counter;
        Ok(())
    }

    pub fn create_todo(ctx: Context<CreateTodo>, title: String) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        let new_todo = &mut ctx.accounts.todo;
        new_todo.title = title;
        new_todo.is_completed = false;
        counter.next_index += 1;
        Ok(())
    }

    pub fn mark_complete(ctx: Context<MarkComplete>, _todo_index: u64) -> Result<()> {
        let todo = &mut ctx.accounts.todo;
        todo.is_completed = true;
        Ok(())
    }

    pub fn update_todo(ctx: Context<UpdateTodo>, _todo_index: u64, new_title: String) -> Result<()> {
        let todo = &mut ctx.accounts.todo;
        todo.title = new_title;
        Ok(())
    }

    pub fn delete_todo(_ctx: Context<DeleteTodo>, _todo_index: u64) -> Result<()> {
        // Account automatically close hoga!
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeCounter<'info> {
    #[account(init, seeds=[user.key().as_ref(), b"counter"], space = 8 + TodoCounter::INIT_SPACE, bump, payer = user)]
    pub counter: Account<'info, TodoCounter>,

    #[account(mut)]
    user: Signer<'info>,

    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateTodo<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds=[user.key().as_ref(), b"counter"], bump = counter.bump)]
    pub counter: Account<'info, TodoCounter>,

    #[account(init, seeds=[user.key().as_ref(), b"todo", &counter.next_index.to_le_bytes()], bump, payer = user, space = 8 + Todo::INIT_SPACE)]
    pub todo: Account<'info, Todo>,

    // Account 4: System program (new account ke liye)
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct TodoCounter {
    pub next_index: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Todo {
    #[max_len(200)]
    pub title: String,
    pub is_completed: bool,
}

#[derive(Accounts)]
#[instruction(todo_index: u64)]
pub struct MarkComplete<'info> {
    #[account(mut)] // User ke constraints?
    pub user: Signer<'info>,

    #[account(mut, seeds=[user.key().as_ref(), b"todo", &todo_index.to_le_bytes()], bump)]
    // Todo ke constraints?
    pub todo: Account<'info, Todo>,
}

#[derive(Accounts)]
#[instruction(todo_index: u64)]
pub struct UpdateTodo<'info> {
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [
            user.key().as_ref(), 
            b"todo", 
            &todo_index.to_le_bytes()
        ],
        bump
    )]
    pub todo: Account<'info, Todo>,
}

#[derive(Accounts)]
#[instruction(todo_index: u64)]
pub struct DeleteTodo<'info> {
    #[account(mut)]  // 👈 Rent wapis lega
    pub user: Signer<'info>,
    
    #[account(
        mut,
        close = user,  // 👈 Magic! Account close + rent return
        seeds = [
            user.key().as_ref(), 
            b"todo", 
            &todo_index.to_le_bytes()
        ],
        bump
    )]
    pub todo: Account<'info, Todo>,
}