In local dev, look at the .env file to get the credentials to run new migrations manually using the mysql cli.

To check the type of a specific type or variable in a file, use tsserver directly, e.g.

```
echo '{"seq":1,"type":"request","command":"open","arguments":{"file":"myfile.ts"}}
{"seq":2,"type":"request","command":"quickinfo","arguments":{"file":"myfile.ts","line":5,"offset":10}}' | npx tsserver
```
