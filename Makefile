all :
	@echo Usage: make package/clean

package :
	npm install
	vsce package
	rm -Rf node_modules

clean :
	rm -f *.vsix
