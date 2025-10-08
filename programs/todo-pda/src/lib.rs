use anchor_lang::prelude::*;

declare_id!("3KycJfDcJV8gLSeaLMKU8PSNiKGNCsdihiJc64kcVFmJ");

#[program]
pub mod todo_pda {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
