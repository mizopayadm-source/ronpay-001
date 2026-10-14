import { getSupabase } from './src/lib/supabase.ts';
import { deleteMultipleSupabaseTransactions } from './src/services/supabaseService.ts';

async function cleanupAllTransactions() {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase not configured");
    return;
  }
  
  // Cleanup Transactions
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('id');
    
  if (txError) {
    console.error("Error fetching transactions:", txError);
  } else if (txData) {
    const ids = txData.map((t: any) => t.id);
    console.log(`Deleting ${ids.length} transactions...`);
    await deleteMultipleSupabaseTransactions(ids);
  }

  // Cleanup Expenses
  const { data: expData, error: expError } = await supabase
    .from('expenses')
    .select('id');
    
  if (expError) {
    console.error("Error fetching expenses:", expError);
  } else if (expData) {
    const ids = expData.map((e: any) => e.id);
    console.log(`Deleting ${ids.length} expenses...`);
    for (const id of ids) {
        await supabase.from('expenses').delete().eq('id', id);
    }
    console.log("Expenses cleanup complete.");
  }
}

cleanupAllTransactions();
