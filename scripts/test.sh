#!/bin/sh

output=$(nc -z localhost 8545; echo $?)
[ $output -eq "0" ] && trpc_running=true
if [ ! $trpc_running ]; then
  testrpc \
    --account="0x79d2f8efdde2f0c738b1df62338699e0dcfb1ba8461800b7a09895a0624b791f,1000000000000000000000000" \
    --account="0xf7054dc781d7a2ff2313fa55305132245cca0dc75dfebbd77debac64e143a3a6,1000000000000000000000000" \
    --account="0xd279f88453ffea4cd7693872f54efd49af2660d6d14f1a60902787d0b3ff9a78,1000000000000000000000000" \
    --account="0x5cdb9e8d2779adddbd33382322f7b3314cbadb6bc6405c05e90c52fa38911d7f,1000000000000000000000000" \
    --account="0x256e1358c121ac17742113a6cc7ebeb49687b6fcd45353ab4bc34ca0abbade57,1000000000000000000000000" \
    --account="0xab24c4dfc0949e2114c93f65e41ea66043718d7588645ab47dd24fa0744234be,1000000000000000000000000" \
    --account="0x1a81d57d48f326cc61bf01bafb6ca883e3592fafb013ce088e4e99c1c0dee129,1000000000000000000000000" \
    --account="0xdfb327fb2f98ca8ffdf4c1053cbce2728acc9c455efcd30793be497ab7173757,1000000000000000000000000" \
    --account="0xc4078af8a36dd9f58ae0553cac95b8ab1e8e14dbca95c95a382b6f2871090c63,1000000000000000000000000" \
    --account="0xf0ef3954ac41c37a6f9ef10bfc36be78e3960e3df248591fb6ad01cabec97ba9,1000000000000000000000000" \
    -l 6000000 \
    > /dev/null &
  trpc_pid=$!
fi

truffle test $1
test_result=$?

if [ ! $trpc_running ]; then
  kill -9 $trpc_pid
fi

exit $test_result
